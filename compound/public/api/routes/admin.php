<?php
/** Admin CRUD for content + submission review. All endpoints require admin. */

function route_admin($method, $seg) {
  require_admin();
  $res = $seg[0] ?? '';
  $id  = isset($seg[1]) && ctype_digit($seg[1]) ? (int)$seg[1] : null;
  $sub = $seg[1] ?? ($seg[2] ?? '');

  switch ($res) {
    case 'overview':   return admin_overview();
    case 'review':     return admin_review($method, $seg);
    case 'users':      return admin_users($method, $id);
    case 'paths':      if ($method === 'GET') json_out(['rows' => db()->query('SELECT * FROM paths WHERE user_id IS NULL ORDER BY id')->fetchAll()]);
                       return admin_crud('paths', $method, $id,
                          ['slug','title','subtitle','goal','description']);
    case 'books':      return admin_books($method, $id, $seg);
    case 'lessons':    return admin_crud('lessons', $method, $id,
                          ['path_id','idx','title','source_book_id','est_minutes','mission_line'], 'path_id');
    case 'cards':      return admin_crud('cards', $method, $id,
                          ['lesson_id','idx','heading','body','quote','callout_title','callout_body','source_label'], 'lesson_id');
    case 'questions':  return admin_questions($method, $id, $seg);
    case 'options':    return admin_crud('quiz_options', $method, $id,
                          ['question_id','idx','label','is_correct'], 'question_id');
    case 'assignment': return admin_assignment($method);
    case 'submissions':return admin_submissions($method, $id, $seg);
  }
  fail('not_found', 404);
}

function admin_overview() {
  $one = fn($sql) => (int)db()->query($sql)->fetchColumn();
  json_out(['ai_enabled' => claude_configured(), 'counts' => [
    'users'       => $one('SELECT COUNT(*) FROM users'),
    'paths'       => $one('SELECT COUNT(*) FROM paths'),
    'lessons'     => $one('SELECT COUNT(*) FROM lessons'),
    'books'       => $one('SELECT COUNT(*) FROM books'),
    'cards'       => $one('SELECT COUNT(*) FROM cards'),
    'questions'   => $one('SELECT COUNT(*) FROM quiz_questions'),
    'submissions' => $one("SELECT COUNT(*) FROM user_assignment WHERE status='submitted'"),
    'ai_review'   => $one('SELECT COUNT(*) FROM books WHERE needs_review = 1') + $one('SELECT COUNT(*) FROM book_lessons WHERE needs_review = 1'),
  ]]);
}

/** Generic list/upsert/delete for a table with a whitelist of columns. */
function admin_crud($table, $method, $id, $cols, $filterCol = null) {
  if ($method === 'GET') {
    if ($filterCol && isset($_GET[$filterCol])) {
      $st = db()->prepare("SELECT * FROM `$table` WHERE `$filterCol` = ? ORDER BY id");
      $st->execute([(int)$_GET[$filterCol]]);
      json_out(['rows' => $st->fetchAll()]);
    }
    json_out(['rows' => db()->query("SELECT * FROM `$table` ORDER BY id")->fetchAll()]);
  }
  if ($method === 'POST') {
    $b = body_json();
    $data = [];
    foreach ($cols as $c) if (array_key_exists($c, $b)) $data[$c] = $b[$c] === '' ? null : $b[$c];
    if (!empty($b['id'])) {
      $sets = implode(', ', array_map(fn($c) => "`$c` = :$c", array_keys($data)));
      $data['id'] = (int)$b['id'];
      db()->prepare("UPDATE `$table` SET $sets WHERE id = :id")->execute($data);
      json_out(['ok' => true, 'id' => (int)$b['id']]);
    } else {
      $keys = array_keys($data);
      $ph = implode(', ', array_map(fn($c) => ":$c", $keys));
      db()->prepare("INSERT INTO `$table` (`" . implode('`,`', $keys) . "`) VALUES ($ph)")->execute($data);
      json_out(['ok' => true, 'id' => (int)db()->lastInsertId()]);
    }
  }
  if ($method === 'DELETE' && $id) {
    db()->prepare("DELETE FROM `$table` WHERE id = ?")->execute([$id]);
    json_out(['ok' => true]);
  }
  fail('method_not_allowed', 405);
}

function admin_books($method, $id, $seg) {
  // GET books/{id}/insights or POST/DELETE insights handled inline
  if (($seg[2] ?? '') === 'insights') {
    if ($method === 'GET') {
      $s = db()->prepare('SELECT * FROM book_insights WHERE book_id = ? ORDER BY idx, id');
      $s->execute([$id]); json_out(['rows' => $s->fetchAll()]);
    }
    if ($method === 'POST') {
      $b = body_json();
      db()->prepare('INSERT INTO book_insights (book_id, idx, text) VALUES (?,?,?)')
          ->execute([$id, (int)($b['idx'] ?? 0), substr($b['text'] ?? '', 0, 400)]);
      json_out(['ok' => true, 'id' => (int)db()->lastInsertId()]);
    }
  }
  return admin_crud('books', $method, $id, ['slug','title','author','category','cover_class','blurb','summary','minutes','sort']);
}

function admin_questions($method, $id, $seg) {
  // GET questions?lesson_id -> questions with nested options
  if ($method === 'GET' && isset($_GET['lesson_id'])) {
    $q = db()->prepare('SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY idx, id');
    $q->execute([(int)$_GET['lesson_id']]);
    $rows = $q->fetchAll();
    $opt = db()->prepare('SELECT * FROM quiz_options WHERE question_id = ? ORDER BY idx, id');
    foreach ($rows as &$r) { $opt->execute([$r['id']]); $r['options'] = $opt->fetchAll(); }
    json_out(['rows' => $rows]);
  }
  return admin_crud('quiz_questions', $method, $id, ['lesson_id','idx','question','explanation'], 'lesson_id');
}

function admin_assignment($method) {
  if ($method === 'GET' && isset($_GET['lesson_id'])) {
    $s = db()->prepare('SELECT * FROM assignments WHERE lesson_id = ?');
    $s->execute([(int)$_GET['lesson_id']]);
    json_out(['assignment' => $s->fetch() ?: null]);
  }
  if ($method === 'POST') {
    $b = body_json();
    $lid = (int)($b['lesson_id'] ?? 0);
    db()->prepare(
      'INSERT INTO assignments (lesson_id, title, instructions, examples, due_days) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), instructions=VALUES(instructions),
         examples=VALUES(examples), due_days=VALUES(due_days)'
    )->execute([$lid, $b['title'] ?? 'Field assignment', $b['instructions'] ?? '', $b['examples'] ?? '', (int)($b['due_days'] ?? 2)]);
    json_out(['ok' => true]);
  }
  fail('method_not_allowed', 405);
}

function admin_submissions($method, $id, $seg) {
  if ($method === 'GET' && !$id) {
    $s = db()->query(
      "SELECT ua.id, ua.status, ua.reflection, ua.submitted_at, ua.feedback,
              u.email, l.title AS lesson_title
       FROM user_assignment ua
       JOIN users u ON u.id = ua.user_id
       JOIN lessons l ON l.id = ua.lesson_id
       WHERE ua.status IN ('submitted','reviewed')
       ORDER BY ua.submitted_at DESC LIMIT 100");
    json_out(['rows' => $s->fetchAll()]);
  }
  if ($method === 'GET' && $id) {
    $s = db()->prepare(
      'SELECT ua.*, u.email, l.title AS lesson_title FROM user_assignment ua
       JOIN users u ON u.id = ua.user_id JOIN lessons l ON l.id = ua.lesson_id WHERE ua.id = ?');
    $s->execute([$id]);
    $row = $s->fetch();
    if (!$row) fail('not_found', 404);
    $f = db()->prepare('SELECT id, kind, original_name FROM assignment_files WHERE user_assignment_id = ?');
    $f->execute([$id]);
    $row['files'] = array_map(fn($x) => ['id'=>(int)$x['id'],'kind'=>$x['kind'],'name'=>$x['original_name'],'url'=>'uploads/'.(int)$x['id']], $f->fetchAll());
    json_out(['submission' => $row]);
  }
  if ($method === 'POST' && $id && ($seg[2] ?? '') === 'review') {
    $b = body_json();
    db()->prepare("UPDATE user_assignment SET status='reviewed', feedback=?, reviewed_at=NOW() WHERE id=?")
        ->execute([substr($b['feedback'] ?? '', 0, 2000), $id]);
    json_out(['ok' => true]);
  }
  fail('not_found', 404);
}

/**
 * AI content review. AI books and lessons are live immediately; this is where an admin checks them.
 *   GET  review                          books + lesson templates flagged needs_review
 *   POST review/books/{id}    {action}   approve | hide | unhide | regenerate (clears summary + insights)
 *   POST review/lessons/{id}  {action}   approve | regenerate (future learners get a fresh lesson)
 */
function admin_review($method, $seg) {
  if ($method === 'GET' && !isset($seg[1])) {
    $books = db()->query(
      "SELECT b.id, b.title, b.author, b.category, b.blurb, b.summary, b.gen_status, b.is_hidden, b.created_at,
              (SELECT COUNT(*) FROM user_books ub WHERE ub.book_id = b.id) AS learners
       FROM books b WHERE b.needs_review = 1 ORDER BY b.id DESC")->fetchAll();
    $ins = db()->prepare('SELECT text FROM book_insights WHERE book_id = ? ORDER BY idx');
    foreach ($books as &$b) { $ins->execute([$b['id']]); $b['insights'] = $ins->fetchAll(PDO::FETCH_COLUMN); }
    unset($b);
    $lessons = db()->query(
      "SELECT bl.id, bl.book_id, bl.title, bl.mission_line, bl.content, bl.created_at, b.title AS book_title
       FROM book_lessons bl JOIN books b ON b.id = bl.book_id WHERE bl.needs_review = 1 ORDER BY bl.id DESC")->fetchAll();
    foreach ($lessons as &$l) { $l['content'] = json_decode($l['content'], true); }
    unset($l);
    json_out(['books' => $books, 'lessons' => $lessons]);
  }
  $kind = $seg[1] ?? ''; $id = (int)($seg[2] ?? 0);
  $action = body_json()['action'] ?? '';
  if ($method !== 'POST' || !$id) fail('not_found', 404);

  if ($kind === 'books') {
    $sql = [
      'approve'    => 'UPDATE books SET needs_review = 0 WHERE id = ?',
      'hide'       => 'UPDATE books SET is_hidden = 1, needs_review = 0 WHERE id = ?',
      'unhide'     => 'UPDATE books SET is_hidden = 0 WHERE id = ?',
      'regenerate' => "UPDATE books SET summary = NULL, gen_status = 'pending', needs_review = 1 WHERE id = ?",
    ][$action] ?? null;
    if (!$sql) fail('invalid_action');
    db()->prepare($sql)->execute([$id]);
    if ($action === 'regenerate') db()->prepare('DELETE FROM book_insights WHERE book_id = ?')->execute([$id]);
    json_out(['ok' => true]);
  }
  if ($kind === 'lessons') {
    if ($action === 'approve') db()->prepare('UPDATE book_lessons SET needs_review = 0 WHERE id = ?')->execute([$id]);
    elseif ($action === 'regenerate') db()->prepare('DELETE FROM book_lessons WHERE id = ?')->execute([$id]);
    else fail('invalid_action');
    json_out(['ok' => true]);
  }
  fail('not_found', 404);
}

/**
 * Learners.
 *   GET    users            list (newest first) with goal, plan, progress
 *   GET    users/{id}       one learner: profile, onboarding, books, lessons, quizzes, assignments
 *   DELETE users/{id}       delete the learner and everything that belongs to them (not admins, not yourself)
 */
function admin_users($method, $id) {
  $me = current_user_opt();
  if ($method === 'GET' && !$id) {
    $rows = db()->query(
      "SELECT u.id, u.email, u.display_name, u.is_admin, u.created_at, u.last_seen_at,
              o.goal, o.role, o.level, o.plan_status,
              COALESCE(st.streak, 0) AS streak,
              (SELECT COUNT(*) FROM user_lesson ul WHERE ul.user_id = u.id AND ul.status = 'done') AS lessons_done,
              (SELECT COUNT(*) FROM user_assignment ua WHERE ua.user_id = u.id AND ua.status IN ('submitted','reviewed')) AS submissions
       FROM users u
       LEFT JOIN onboarding o ON o.user_id = u.id
       LEFT JOIN user_stats st ON st.user_id = u.id
       ORDER BY u.id DESC LIMIT 1000")->fetchAll();
    foreach ($rows as &$r) { $r['is_admin'] = is_admin_row($r); }
    unset($r);
    json_out(['rows' => $rows]);
  }
  if (!$id) fail('not_found', 404);
  $u = db()->prepare('SELECT * FROM users WHERE id = ?');
  $u->execute([$id]);
  $user = $u->fetch();
  if (!$user) fail('not_found', 404);

  if ($method === 'GET') {
    $one = function ($sql) use ($id) { $s = db()->prepare($sql); $s->execute([$id]); return $s; };
    $ob = $one('SELECT goal, focus_areas, target, role, level, daily_minutes, format, plan_status, created_at FROM onboarding WHERE user_id = ?')->fetch() ?: null;
    if ($ob) $ob['focus_areas'] = json_decode($ob['focus_areas'] ?: '[]', true);
    json_out(['user' => [
      'id' => (int)$user['id'], 'email' => $user['email'], 'display_name' => $user['display_name'],
      'is_admin' => is_admin_row($user), 'created_at' => $user['created_at'], 'last_seen_at' => $user['last_seen_at'],
      'onboarding'  => $ob,
      'stats'       => $one('SELECT streak, growth_score, insights_learned, actions_done, last_active_date FROM user_stats WHERE user_id = ?')->fetch() ?: null,
      'books'       => $one('SELECT b.title, b.author, b.gen_status, ub.rank_no FROM user_books ub JOIN books b ON b.id = ub.book_id WHERE ub.user_id = ? ORDER BY ub.rank_no')->fetchAll(),
      'lessons'     => $one("SELECT l.title, ul.status, ul.completed_at FROM user_lesson ul JOIN lessons l ON l.id = ul.lesson_id WHERE ul.user_id = ? ORDER BY ul.id DESC LIMIT 50")->fetchAll(),
      'quizzes'     => $one('SELECT l.title, uq.score, uq.total, uq.taken_at FROM user_quiz uq JOIN lessons l ON l.id = uq.lesson_id WHERE uq.user_id = ? ORDER BY uq.id DESC LIMIT 50')->fetchAll(),
      'assignments' => $one('SELECT ua.id, a.title, ua.status, ua.submitted_at, ua.due_at FROM user_assignment ua JOIN assignments a ON a.lesson_id = ua.lesson_id WHERE ua.user_id = ? ORDER BY ua.id DESC LIMIT 50')->fetchAll(),
      'coach_messages' => (int)$one('SELECT COUNT(*) FROM coach_messages WHERE user_id = ?')->fetchColumn(),
      'sessions'    => (int)$one('SELECT COUNT(*) FROM sessions WHERE user_id = ? AND expires_at > NOW()')->fetchColumn(),
    ]]);
  }

  if ($method === 'DELETE') {
    if ($me && (int)$me['id'] === (int)$id) fail('cannot_delete_self', 409);
    if (is_admin_row($user)) fail('cannot_delete_admin', 409);
    $pdo = db();
    $pdo->beginTransaction();
    try {
      // personal plan: its lessons (and their cards, quizzes, assignments, progress) go with the path
      $pdo->prepare('DELETE FROM paths WHERE user_id = ?')->execute([$id]);
      $pdo->prepare('DELETE FROM login_codes WHERE email = ?')->execute([$user['email']]);
      // everything else hangs off users with ON DELETE CASCADE
      $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
      $pdo->commit();
    } catch (Throwable $e) {
      $pdo->rollBack();
      error_log('[admin_users delete] ' . $e->getMessage());
      fail('server_error', 500);
    }
    // uploaded proof files live in uploads/{user id}/
    $dir = realpath(__DIR__ . '/../uploads/' . (int)$id);
    $base = realpath(__DIR__ . '/../uploads');
    if ($dir && $base && strpos($dir, $base . DIRECTORY_SEPARATOR) === 0 && is_dir($dir)) {
      foreach (glob($dir . '/*') ?: [] as $f) if (is_file($f)) @unlink($f);
      @rmdir($dir);
    }
    json_out(['ok' => true]);
  }
  fail('method_not_allowed', 405);
}

function is_admin_row($u) {
  $admins = array_map('strtolower', cfg('admin_emails') ?: []);
  return (bool)$u['is_admin'] || in_array(strtolower($u['email']), $admins, true);
}
