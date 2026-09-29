<?php
/**
 * AI learning plan.
 *   POST plan/build                 Claude picks 10 books for the learner's goal and builds a personal path
 *   GET  plan                       plan status + the learner's books
 *   POST plan/books/{id}/summary    write the summary + key insights for a book (once, shared by everyone)
 *   POST plan/lessons/{id}/prepare  fill a personal lesson: shared cards + quiz for the book, personal SMART goal
 *
 * AI books and lessons go live immediately and are flagged needs_review for the admin.
 */

const PLAN_BOOKS = 10;

function route_plan($method, $seg) {
  $user = require_user();
  $a = $seg[0] ?? '';

  if ($method === 'GET' && $a === '') json_out(plan_state($user['id']));
  if ($method === 'POST' && $a === 'build') return plan_build($user);
  if ($method === 'POST' && $a === 'books' && ctype_digit($seg[1] ?? '') && ($seg[2] ?? '') === 'summary') {
    return plan_book_summary((int)$seg[1]);
  }
  if ($method === 'POST' && $a === 'lessons' && ctype_digit($seg[1] ?? '') && ($seg[2] ?? '') === 'prepare') {
    return plan_prepare_lesson($user, (int)$seg[1]);
  }
  fail('not_found', 404);
}

function plan_state($uid) {
  $o = db()->prepare('SELECT plan_status FROM onboarding WHERE user_id = ?');
  $o->execute([$uid]);
  return ['ai' => claude_configured(), 'status' => $o->fetchColumn() ?: 'none', 'books' => user_plan_books($uid)];
}

function user_plan_books($uid) {
  $s = db()->prepare(
    'SELECT b.id, b.title, b.author, b.category, b.cover_class, b.blurb, b.minutes, b.gen_status, ub.rank_no, ub.reason
     FROM user_books ub JOIN books b ON b.id = ub.book_id
     WHERE ub.user_id = ? AND b.is_hidden = 0 ORDER BY ub.rank_no');
  $s->execute([$uid]);
  return array_map(function ($b) { $b['id'] = (int)$b['id']; $b['rank_no'] = (int)$b['rank_no']; return $b; }, $s->fetchAll());
}

function user_profile($uid) {
  $o = db()->prepare('SELECT goal, focus_areas, target, role, level, daily_minutes FROM onboarding WHERE user_id = ?');
  $o->execute([$uid]);
  $p = $o->fetch() ?: [];
  $p['focus_areas'] = json_decode($p['focus_areas'] ?? '[]', true) ?: [];
  return $p;
}

function profile_text($p) {
  $targets = ['2w' => '2 weeks', '30d' => '30 days', '90d' => '90 days'];
  return "Goal: " . ($p['goal'] ?? 'Communication') .
    "\nFocus areas: " . ($p['focus_areas'] ? implode(', ', $p['focus_areas']) : 'not specified') .
    "\nRole: " . (($p['role'] ?? '') ?: 'not specified') .
    "\nExperience level: " . (($p['level'] ?? '') ?: 'not specified') .
    "\nTime available: " . (int)($p['daily_minutes'] ?? 10) . " minutes a day" .
    "\nWants results within: " . ($targets[$p['target'] ?? ''] ?? '30 days');
}

function slugify($s) {
  $s = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $s), '-'));
  return substr($s ?: 'book', 0, 110);
}

// ---------- 1. choose the books and build the personal path ----------

function plan_build($user) {
  if (!claude_configured()) json_out(['ai' => false]);
  $uid = (int)$user['id'];
  $p = user_profile($uid);
  if (!$p || empty($p['goal'])) fail('onboarding_required', 409);
  if (!rate_ok('plan:' . $uid, 4, 3600)) fail('too_many_requests', 429);

  $schema = js_obj([
    'books' => js_arr(js_obj([
      'title'    => js_str('Exact published title'),
      'author'   => js_str('Author name(s) as published'),
      'category' => js_str('One or two words, e.g. Communication, Productivity, Leadership, Habits, Career, Mindset'),
      'blurb'    => js_str('One or two sentences on what the book teaches'),
      'reason'   => js_str('One sentence, addressed to the learner as "you", on why this book fits their goal'),
    ]), 'Ordered for learning: foundations first, then applied and advanced'),
  ]);
  $system =
    "You choose books for a learning app that turns book ideas into real-world practice. " .
    "Recommend only real, widely available non-fiction books you know well enough to summarise accurately. " .
    "Never invent a title or an author. Prefer books with practical, actionable ideas over theory.";
  $prompt =
    "Pick 12 books, ranked, that will best help this learner reach their goal. " .
    "Order them as a learning sequence: foundational ideas first, then applied, then advanced.\n\n" . profile_text($p);

  $out = claude_json($system, $prompt, $schema, 6000);
  if (!$out || empty($out['books'])) {
    db()->prepare('UPDATE onboarding SET plan_status = \'failed\' WHERE user_id = ?')->execute([$uid]);
    fail('ai_unavailable', 503);
  }

  $covers = ['cov1', 'cov2', 'cov3', 'cov4', 'cov5', 'cov6'];
  $find = db()->prepare('SELECT id, is_hidden FROM books WHERE slug = ? OR LOWER(title) = LOWER(?) LIMIT 1');
  $ins  = db()->prepare(
    'INSERT INTO books (slug, title, author, category, cover_class, blurb, minutes, sort, source, needs_review, gen_status)
     VALUES (?,?,?,?,?,?,?,?,\'ai\',1,\'pending\')');
  $chosen = [];
  foreach ($out['books'] as $b) {
    if (count($chosen) >= PLAN_BOOKS) break;
    $title = trim(substr($b['title'] ?? '', 0, 200));
    $author = trim(substr($b['author'] ?? '', 0, 160));
    if ($title === '' || $author === '') continue;
    $slug = slugify($title);
    $find->execute([$slug, $title]);
    $row = $find->fetch();
    if ($row && $row['is_hidden']) continue; // an admin removed this book
    if ($row) { $bid = (int)$row['id']; }
    else {
      $ins->execute([$slug, $title, $author, trim(substr($b['category'] ?? 'Growth', 0, 60)) ?: 'Growth',
        $covers[crc32($slug) % 6], trim(substr($b['blurb'] ?? '', 0, 600)), 9, 100]);
      $bid = (int)db()->lastInsertId();
    }
    if (isset($chosen[$bid])) continue;
    $chosen[$bid] = trim(substr($b['reason'] ?? '', 0, 400));
  }
  if (!$chosen) fail('ai_unavailable', 503);

  $pdo = db();
  $pdo->beginTransaction();
  try {
    $pdo->prepare('DELETE FROM user_books WHERE user_id = ?')->execute([$uid]);
    $ub = $pdo->prepare('INSERT INTO user_books (user_id, book_id, rank_no, reason) VALUES (?,?,?,?)');
    $rank = 0;
    foreach ($chosen as $bid => $reason) $ub->execute([$uid, $bid, ++$rank, $reason]);

    // one personal path per learner; rebuilding replaces lessons not yet started
    $pp = $pdo->prepare('SELECT id FROM paths WHERE user_id = ? LIMIT 1');
    $pp->execute([$uid]);
    $pid = (int)$pp->fetchColumn();
    $goal = substr($p['goal'], 0, 60);
    if (!$pid) {
      $pdo->prepare('INSERT INTO paths (slug, title, subtitle, goal, description, user_id) VALUES (?,?,?,?,?,?)')
        ->execute(['u' . $uid . '-' . bin2hex(random_bytes(3)), 'Your ' . $goal . ' plan',
          count($chosen) . ' books picked for you', $goal,
          'Books chosen for your goal, one practical idea at a time.', $uid]);
      $pid = (int)$pdo->lastInsertId();
    } else {
      $pdo->prepare('UPDATE paths SET title = ?, goal = ?, subtitle = ? WHERE id = ?')
        ->execute(['Your ' . $goal . ' plan', $goal, count($chosen) . ' books picked for you', $pid]);
      $pdo->prepare(
        'DELETE l FROM lessons l LEFT JOIN user_lesson ul ON ul.lesson_id = l.id AND ul.user_id = ?
         WHERE l.path_id = ? AND ul.id IS NULL')->execute([$uid, $pid]);
    }
    $kept = $pdo->prepare('SELECT source_book_id FROM lessons WHERE path_id = ?');
    $kept->execute([$pid]);
    $have = array_flip(array_map('intval', $kept->fetchAll(PDO::FETCH_COLUMN)));
    $mx = $pdo->prepare('SELECT COALESCE(MAX(idx), 0) FROM lessons WHERE path_id = ?');
    $mx->execute([$pid]);
    $idx = (int)$mx->fetchColumn();
    $bt = $pdo->prepare('SELECT title FROM books WHERE id = ?');
    $li = $pdo->prepare('INSERT INTO lessons (path_id, idx, title, source_book_id, est_minutes, mission_line) VALUES (?,?,?,?,?,NULL)');
    $mins = max(5, min(20, (int)($p['daily_minutes'] ?? 10)));
    foreach (array_keys($chosen) as $bid) {
      if (isset($have[$bid])) continue;
      $bt->execute([$bid]);
      $li->execute([$pid, ++$idx, 'The big idea from ' . $bt->fetchColumn(), $bid, $mins]);
    }
    $pdo->prepare('UPDATE onboarding SET plan_status = \'ready\' WHERE user_id = ?')->execute([$uid]);
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[plan_build] ' . $e->getMessage());
    fail('server_error', 500);
  }
  json_out(['ai' => true, 'path_id' => $pid] + plan_state($uid));
}

// ---------- 2. book summary (shared) ----------

function plan_book_summary($bid) {
  $b = db()->prepare('SELECT * FROM books WHERE id = ?');
  $b->execute([$bid]);
  $book = $b->fetch();
  if (!$book || $book['is_hidden']) fail('not_found', 404);
  if (trim((string)$book['summary']) !== '') json_out(['status' => 'ready']);
  if (!claude_configured()) fail('ai_unavailable', 503);

  // one writer per book; others wait for it to finish
  $lock = 'compound_book_' . $bid;
  if (!db()->query("SELECT GET_LOCK(" . db()->quote($lock) . ", 170)")->fetchColumn()) fail('busy', 503);
  try {
    $b->execute([$bid]);
    $book = $b->fetch();
    if (trim((string)$book['summary']) !== '') json_out(['status' => 'ready']);

    $schema = js_obj([
      'blurb'    => js_str('One or two sentences on what the book teaches'),
      'summary'  => js_arr(js_str(), 'Four to five paragraphs, 170 to 230 words in total'),
      'insights' => js_arr(js_str(), 'Exactly five key insights, each under 20 words, each something a reader can act on'),
    ]);
    $system =
      "You write accurate, plain-English book summaries for a learning app. Write in your own words; never quote " .
      "more than a short phrase from the book. Only state what the book actually argues. If you are not confident " .
      "about a detail, leave it out. Use short sentences a busy professional can listen to.";
    $prompt = "Summarise \"{$book['title']}\" by {$book['author']}. Cover the core argument, the main ideas and " .
      "how a reader would apply them. Paragraphs are read aloud, so avoid lists and symbols inside them.";
    $out = claude_json($system, $prompt, $schema, 6000);
    if (!$out || empty($out['summary'])) {
      db()->prepare('UPDATE books SET gen_status = \'failed\' WHERE id = ?')->execute([$bid]);
      fail('ai_unavailable', 503);
    }
    $summary = implode("\n\n", array_map('trim', array_filter($out['summary'], 'is_string')));
    $words = str_word_count($summary);
    db()->prepare(
      'UPDATE books SET summary = ?, blurb = IF(blurb IS NULL OR blurb = \'\', ?, blurb), minutes = ?,
         gen_status = \'ready\', needs_review = IF(source = \'ai\', 1, needs_review) WHERE id = ?'
    )->execute([$summary, substr($out['blurb'] ?? '', 0, 600), max(2, (int)ceil($words / 140)), $bid]);
    $cnt = db()->prepare('SELECT COUNT(*) FROM book_insights WHERE book_id = ?');
    $cnt->execute([$bid]);
    if (!(int)$cnt->fetchColumn()) {
      $bi = db()->prepare('INSERT INTO book_insights (book_id, idx, text) VALUES (?,?,?)');
      foreach (array_slice($out['insights'] ?? [], 0, 5) as $i => $t) $bi->execute([$bid, $i + 1, substr($t, 0, 400)]);
    }
    json_out(['status' => 'ready']);
  } finally {
    db()->query("SELECT RELEASE_LOCK(" . db()->quote($lock) . ")");
  }
}

// ---------- 3. lesson: shared cards + quiz per book, personal SMART goal ----------

function book_lesson_template($book) {
  $bid = (int)$book['id'];
  $get = db()->prepare('SELECT * FROM book_lessons WHERE book_id = ?');
  $get->execute([$bid]);
  if ($t = $get->fetch()) return $t;

  $lock = 'compound_lesson_' . $bid;
  if (!db()->query("SELECT GET_LOCK(" . db()->quote($lock) . ", 170)")->fetchColumn()) return null;
  try {
    $get->execute([$bid]);
    if ($t = $get->fetch()) return $t;

    $card = js_obj([
      'heading'       => js_str('A short, punchy statement of the insight'),
      'body'          => js_str('Two to three sentences explaining it in plain words'),
      'quote'         => js_str('A one-line takeaway in your own words (not a quotation from the book)'),
      'callout_title' => js_str('Two or three words, e.g. "Try this", "Watch for", "Say it like"'),
      'callout_body'  => js_str('One concrete sentence the reader can use today'),
    ]);
    $q = js_obj([
      'question'     => js_str(),
      'options'      => js_arr(js_str(), 'Exactly four answer options'),
      'correct_index'=> ['type' => 'integer', 'description' => '0-based index of the correct option'],
      'explanation'  => js_str('One or two sentences on why that answer is right'),
    ]);
    $schema = js_obj([
      'title'        => js_str('Lesson title: the single most practical idea, as an action, under 8 words'),
      'mission_line' => js_str('One-line real-world mission to practise the idea, under 14 words'),
      'cards'        => js_arr($card, 'Exactly five insight cards that build on each other'),
      'quiz'         => js_arr($q, 'Exactly three questions testing understanding and application, not trivia'),
      'assignment'   => js_obj([
        'title'        => js_str(),
        'instructions' => js_str('What to do in the next two days, under 60 words'),
        'examples'     => js_str('One or two example lines or situations, under 50 words'),
      ]),
    ]);
    $system =
      "You design 10-minute micro-lessons that turn one book idea into real-world behaviour. " .
      "Be accurate to the book, write in your own words, and keep every line concrete and usable.";
    $prompt = "Create a lesson on the single most practical idea from \"{$book['title']}\" by {$book['author']}." .
      ($book['summary'] ? "\n\nBook summary for reference:\n" . $book['summary'] : '');
    $out = claude_json($system, $prompt, $schema, 8000);
    if (!$out || empty($out['cards']) || empty($out['quiz'])) return null;

    db()->prepare('INSERT INTO book_lessons (book_id, title, mission_line, content, needs_review) VALUES (?,?,?,?,1)')
      ->execute([$bid, substr($out['title'], 0, 200), substr($out['mission_line'], 0, 255),
        json_encode(['cards' => $out['cards'], 'quiz' => $out['quiz'], 'assignment' => $out['assignment']], JSON_UNESCAPED_UNICODE)]);
    $get->execute([$bid]);
    return $get->fetch();
  } finally {
    db()->query("SELECT RELEASE_LOCK(" . db()->quote($lock) . ")");
  }
}

function learner_activity_text($uid) {
  $q = db()->prepare(
    'SELECT l.title, uq.score, uq.total FROM user_quiz uq JOIN lessons l ON l.id = uq.lesson_id
     WHERE uq.user_id = ? ORDER BY uq.id DESC LIMIT 5');
  $q->execute([$uid]);
  $lines = [];
  foreach ($q->fetchAll() as $r) $lines[] = "Quiz on \"{$r['title']}\": {$r['score']}/{$r['total']}";
  $a = db()->prepare(
    'SELECT l.title, ua.status, ua.reflection FROM user_assignment ua JOIN lessons l ON l.id = ua.lesson_id
     WHERE ua.user_id = ? ORDER BY ua.id DESC LIMIT 3');
  $a->execute([$uid]);
  foreach ($a->fetchAll() as $r) {
    $lines[] = "Assignment \"{$r['title']}\": {$r['status']}" .
      ($r['reflection'] ? ' - their notes: "' . substr(str_replace(["\r", "\n"], ' ', $r['reflection']), 0, 300) . '"' : '');
  }
  return $lines ? implode("\n", $lines) : 'No activity yet; this is their first lesson.';
}

function plan_prepare_lesson($user, $lid) {
  $uid = (int)$user['id'];
  $l = db()->prepare(
    'SELECT l.*, p.user_id AS owner FROM lessons l JOIN paths p ON p.id = l.path_id WHERE l.id = ?');
  $l->execute([$lid]);
  $lesson = $l->fetch();
  if (!$lesson || (int)$lesson['owner'] !== $uid) fail('not_found', 404);

  $has = db()->prepare('SELECT COUNT(*) FROM cards WHERE lesson_id = ?');
  $has->execute([$lid]);
  if ((int)$has->fetchColumn() > 0) json_out(['status' => 'ready']);
  if (!claude_configured()) fail('ai_unavailable', 503);

  $b = db()->prepare('SELECT * FROM books WHERE id = ?');
  $b->execute([(int)$lesson['source_book_id']]);
  $book = $b->fetch();
  if (!$book) fail('not_found', 404);

  // one preparer per lesson (the app may prefetch while the learner opens it)
  $lock = 'compound_ul_' . $lid;
  if (!db()->query("SELECT GET_LOCK(" . db()->quote($lock) . ", 170)")->fetchColumn()) fail('busy', 503);
  $has->execute([$lid]);
  if ((int)$has->fetchColumn() > 0) json_out(['status' => 'ready']);

  $tpl = book_lesson_template($book);
  if (!$tpl) fail('ai_unavailable', 503);
  $content = json_decode($tpl['content'], true) ?: [];

  // personal SMART goal + field assignment from the learner's profile and recent practice
  $smartSchema = js_obj([
    'smart' => js_obj([
      'specific'   => js_str('Exactly what they will do, in one sentence'),
      'measurable' => js_str('How they will know they did it, in one sentence'),
      'achievable' => js_str('Why this fits their level and time, in one sentence'),
      'relevant'   => js_str('How it moves their goal forward, in one sentence'),
      'time_bound' => js_str('When, within the next 48 hours, in one sentence'),
    ]),
    'assignment' => js_obj([
      'title'        => js_str('Short assignment title'),
      'instructions' => js_str('What to do and what proof to send (photo or voice note), under 60 words'),
      'examples'     => js_str('One or two example lines they could say or do, under 50 words'),
    ]),
  ]);
  $system =
    "You are a practical coach writing a personal SMART goal for a learner, based on one lesson. " .
    "Fit the goal to their role, level and time available, and build on how their recent practice went: " .
    "if quizzes were weak or assignments were skipped, make the goal smaller and easier to start.";
  $prompt = profile_text(user_profile($uid)) .
    "\n\nRecent activity:\n" . learner_activity_text($uid) .
    "\n\nLesson: \"{$tpl['title']}\" from \"{$book['title']}\" by {$book['author']}." .
    "\nMission: {$tpl['mission_line']}" .
    "\nKey points: " . implode(' | ', array_map(fn($c) => $c['heading'] ?? '', $content['cards'] ?? [])) .
    "\n\nWrite a SMART goal and a matching field assignment the learner can finish within 48 hours.";
  $personal = claude_json($system, $prompt, $smartSchema, 4000, 'low');
  $asg = $personal['assignment'] ?? ($content['assignment'] ?? null);

  $pdo = db();
  $pdo->beginTransaction();
  try {
    $pdo->prepare('UPDATE lessons SET title = ?, mission_line = ? WHERE id = ?')
      ->execute([$tpl['title'], $tpl['mission_line'], $lid]);
    $ci = $pdo->prepare(
      'INSERT INTO cards (lesson_id, idx, heading, body, quote, callout_title, callout_body, source_label) VALUES (?,?,?,?,?,?,?,?)');
    foreach (array_values($content['cards'] ?? []) as $i => $c) {
      $ci->execute([$lid, $i + 1, substr($c['heading'] ?? '', 0, 255), $c['body'] ?? '', $c['quote'] ?? '',
        substr($c['callout_title'] ?? '', 0, 120), $c['callout_body'] ?? '', substr($book['title'] . ' · ' . $book['author'], 0, 160)]);
    }
    $qi = $pdo->prepare('INSERT INTO quiz_questions (lesson_id, idx, question, explanation) VALUES (?,?,?,?)');
    $oi = $pdo->prepare('INSERT INTO quiz_options (question_id, idx, label, is_correct) VALUES (?,?,?,?)');
    foreach (array_values($content['quiz'] ?? []) as $i => $q) {
      $opts = array_values($q['options'] ?? []);
      if (count($opts) < 2) continue;
      $qi->execute([$lid, $i + 1, substr($q['question'], 0, 400), substr($q['explanation'] ?? '', 0, 600)]);
      $qid = (int)$pdo->lastInsertId();
      $correct = max(0, min(count($opts) - 1, (int)($q['correct_index'] ?? 0)));
      foreach ($opts as $j => $o) $oi->execute([$qid, $j + 1, substr($o, 0, 300), $j === $correct ? 1 : 0]);
    }
    if ($asg) {
      $pdo->prepare(
        'INSERT INTO assignments (lesson_id, title, instructions, examples, due_days, smart_goal) VALUES (?,?,?,?,2,?)
         ON DUPLICATE KEY UPDATE title = VALUES(title), instructions = VALUES(instructions),
           examples = VALUES(examples), smart_goal = VALUES(smart_goal)')
        ->execute([$lid, substr($asg['title'] ?? 'Field assignment', 0, 200), substr($asg['instructions'] ?? '', 0, 600),
          substr($asg['examples'] ?? '', 0, 600),
          isset($personal['smart']) ? json_encode($personal['smart'], JSON_UNESCAPED_UNICODE) : null]);
    }
    $pdo->commit();
  } catch (Throwable $e) {
    $pdo->rollBack();
    error_log('[plan_prepare_lesson] ' . $e->getMessage());
    fail('server_error', 500);
  }
  json_out(['status' => 'ready']);
}
