<?php
/** Home bundle, progress dashboard, stats, and playbook. */
require_once __DIR__ . '/paths.php'; // for lessons_with_status()

function user_path_id($uid) {
  // a personal AI plan wins over the shared path for the goal
  $pp = db()->prepare('SELECT id FROM paths WHERE user_id = ? LIMIT 1');
  $pp->execute([$uid]);
  if ($pid = $pp->fetchColumn()) return (int)$pid;
  $o = db()->prepare('SELECT goal FROM onboarding WHERE user_id = ?');
  $o->execute([$uid]);
  $goal = $o->fetchColumn();
  if ($goal) {
    $p = db()->prepare('SELECT id FROM paths WHERE goal = ? ORDER BY id LIMIT 1');
    $p->execute([$goal]);
    $pid = $p->fetchColumn();
    if ($pid) return (int)$pid;
  }
  return (int)(db()->query('SELECT id FROM paths ORDER BY id LIMIT 1')->fetchColumn() ?: 0);
}

function user_has_plan($uid) {
  $s = db()->prepare('SELECT 1 FROM paths WHERE user_id = ? LIMIT 1');
  $s->execute([$uid]);
  return (bool)$s->fetchColumn();
}

function next_after($lessons, $current) {
  if (!$current) return null;
  $seen = false;
  foreach ($lessons as $l) { if ($seen) return $l; if ($l['id'] === $current['id']) $seen = true; }
  return null;
}

function route_home($method, $seg) {
  $user = require_user();
  $stats = ensure_stats($user['id']);
  $pid = user_path_id($user['id']);
  $lessons = $pid ? lessons_with_status($pid, $user['id']) : [];
  $done = count(array_filter($lessons, fn($l) => $l['status'] === 'done'));
  $total = count($lessons);
  $current = null;
  foreach ($lessons as $l) { if ($l['status'] === 'now') { $current = $l; break; } }
  if (!$current) foreach ($lessons as $l) { if ($l['status'] !== 'done') { $current = $l; break; } }

  $path = db()->prepare('SELECT id, title FROM paths WHERE id = ?');
  $path->execute([$pid]);
  $pathRow = $path->fetch() ?: null;

  $bs = db()->prepare(
    'SELECT b.id, b.slug, b.title, b.author, b.category, b.cover_class, b.minutes, b.gen_status, ub.rank_no, ub.reason FROM user_books ub
     JOIN books b ON b.id = ub.book_id WHERE ub.user_id = ? AND b.is_hidden = 0 ORDER BY ub.rank_no LIMIT 10');
  $bs->execute([$user['id']]);
  $books = $bs->fetchAll();
  if (!$books) {
    $books = db()->query('SELECT id, slug, title, author, category, cover_class, minutes FROM books WHERE is_hidden = 0 ORDER BY sort, id LIMIT 4')->fetchAll();
  }

  json_out([
    'stats' => stat_out($stats),
    'path'  => $pathRow ? [
      'id' => (int)$pathRow['id'], 'title' => $pathRow['title'],
      'completed' => $done, 'total' => $total,
      'percent' => $total ? round($done * 100 / $total) : 0,
    ] : null,
    'current_lesson' => $current,
    'next_lesson' => next_after($lessons, $current),
    'books' => $books,
    'personal' => (bool)$books && user_has_plan($user['id']),
  ]);
}

function route_progress($method, $seg) {
  $user = require_user();
  $stats = ensure_stats($user['id']);

  // weekly activity: events per day for the last 7 days
  $labels = []; $values = [];
  for ($i = 6; $i >= 0; $i--) {
    $day = date('Y-m-d', strtotime("-$i day"));
    $labels[] = date('D', strtotime($day))[0]; // M T W ...
    $c = db()->prepare(
      'SELECT
        (SELECT COUNT(*) FROM user_lesson    WHERE user_id=? AND DATE(completed_at)=?) +
        (SELECT COUNT(*) FROM user_quiz      WHERE user_id=? AND DATE(taken_at)=?) +
        (SELECT COUNT(*) FROM user_assignment WHERE user_id=? AND DATE(submitted_at)=?)');
    $c->execute([$user['id'],$day,$user['id'],$day,$user['id'],$day]);
    $values[] = (int)$c->fetchColumn();
  }

  $pb = db()->prepare('SELECT id, title, source, tried_count FROM playbook WHERE user_id = ? ORDER BY id DESC LIMIT 20');
  $pb->execute([$user['id']]);

  json_out([
    'stats'    => stat_out($stats),
    'weekly'   => ['labels' => $labels, 'values' => $values],
    'playbook' => $pb->fetchAll(),
  ]);
}

function route_stats($method, $seg) {
  $user = require_user();
  json_out(['stats' => stat_out(ensure_stats($user['id']))]);
}

function route_playbook($method, $seg) {
  $user = require_user();
  if ($method === 'GET') {
    $pb = db()->prepare('SELECT id, title, source, tried_count FROM playbook WHERE user_id = ? ORDER BY id DESC');
    $pb->execute([$user['id']]);
    json_out(['playbook' => $pb->fetchAll()]);
  }
  if ($method === 'POST') {
    $b = body_json();
    $title = substr(trim($b['title'] ?? ''), 0, 300);
    if ($title === '') fail('title_required');
    $source = substr(trim($b['source'] ?? ''), 0, 200);
    db()->prepare('INSERT INTO playbook (user_id, title, source) VALUES (?,?,?)')
        ->execute([$user['id'], $title, $source]);
    json_out(['ok' => true, 'id' => (int)db()->lastInsertId()]);
  }
  fail('method_not_allowed', 405);
}

function stat_out($s) {
  return [
    'streak'           => (int)$s['streak'],
    'growth_score'     => (int)$s['growth_score'],
    'insights_learned' => (int)$s['insights_learned'],
    'actions_done'     => (int)$s['actions_done'],
  ];
}

/**
 * GET timeline -> the learner's journey (newest first) plus a summary for the profile and share card.
 */
function route_timeline($method, $seg) {
  $user = require_user();
  $uid = (int)$user['id'];
  $ev = [];
  $add = function ($type, $at, $title, $detail = null) use (&$ev) {
    if ($at) $ev[] = ['type' => $type, 'at' => $at, 'title' => $title, 'detail' => $detail];
  };

  $add('joined', $user['created_at'], 'Joined Compound', 'Your journey started here');

  $p = db()->prepare('SELECT p.created_at, p.goal, COUNT(l.id) AS n FROM paths p LEFT JOIN lessons l ON l.path_id = p.id WHERE p.user_id = ? GROUP BY p.id');
  $p->execute([$uid]);
  foreach ($p->fetchAll() as $r) $add('plan', $r['created_at'], 'Your ' . $r['goal'] . ' plan was built', $r['n'] . ' books picked for you');

  $l = db()->prepare(
    'SELECT ul.completed_at, l.title, b.title AS book FROM user_lesson ul JOIN lessons l ON l.id = ul.lesson_id
     LEFT JOIN books b ON b.id = l.source_book_id WHERE ul.user_id = ? AND ul.status = \'done\' ORDER BY ul.completed_at DESC LIMIT 60');
  $l->execute([$uid]);
  foreach ($l->fetchAll() as $r) $add('lesson', $r['completed_at'], 'Finished “' . $r['title'] . '”', $r['book'] ? 'From ' . $r['book'] : null);

  $q = db()->prepare(
    'SELECT uq.taken_at, uq.score, uq.total, l.title FROM user_quiz uq JOIN lessons l ON l.id = uq.lesson_id
     WHERE uq.user_id = ? ORDER BY uq.id DESC LIMIT 60');
  $q->execute([$uid]);
  foreach ($q->fetchAll() as $r) $add('quiz', $r['taken_at'], 'Quiz: ' . $r['score'] . '/' . $r['total'], $r['title']);

  $a = db()->prepare(
    'SELECT ua.submitted_at, ua.reviewed_at, ua.feedback, a.title FROM user_assignment ua
     JOIN assignments a ON a.lesson_id = ua.lesson_id WHERE ua.user_id = ? ORDER BY ua.id DESC LIMIT 60');
  $a->execute([$uid]);
  foreach ($a->fetchAll() as $r) {
    $add('assignment', $r['submitted_at'], 'Sent proof: ' . $r['title'], 'Field assignment done');
    $add('review', $r['reviewed_at'], 'Coach reviewed “' . $r['title'] . '”', $r['feedback'] ? mb_substr($r['feedback'], 0, 160) : null);
  }
  usort($ev, fn($x, $y) => strcmp($y['at'], $x['at']));

  // summary
  $one = function ($sql) use ($uid) { $s = db()->prepare($sql); $s->execute([$uid]); return $s->fetchColumn(); };
  $pid = user_path_id($uid);
  $lessons = $pid ? lessons_with_status($pid, $uid) : [];
  $now = null;
  foreach ($lessons as $x) { if ($x['status'] === 'now') { $now = $x['title']; break; } }
  $o = db()->prepare('SELECT goal, role, level, daily_minutes FROM onboarding WHERE user_id = ?');
  $o->execute([$uid]);
  $stats = stat_out(ensure_stats($uid));
  json_out([
    'events'  => array_slice($ev, 0, 100),
    'summary' => $stats + [
      'lessons_done'   => count(array_filter($lessons, fn($x) => $x['status'] === 'done')),
      'lessons_total'  => count($lessons),
      'quiz_avg'       => (int)round((float)$one('SELECT AVG(score / NULLIF(total, 0)) * 100 FROM user_quiz WHERE user_id = ?')),
      'assignments'    => (int)$one("SELECT COUNT(*) FROM user_assignment WHERE user_id = ? AND status IN ('submitted','reviewed')"),
      'books'          => (int)$one('SELECT COUNT(*) FROM user_books WHERE user_id = ?'),
      'now_practising' => $now,
      'profile'        => $o->fetch() ?: null,
    ],
  ]);
}
