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
