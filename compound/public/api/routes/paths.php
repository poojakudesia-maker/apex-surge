<?php
/** Paths + lesson lists with per-user lock/done state. */

function route_paths($method, $seg) {
  $user = require_user();

  if ($method === 'GET' && empty($seg)) {
    $rows = db()->query('SELECT id, slug, title, subtitle, goal, description FROM paths ORDER BY id')->fetchAll();
    json_out(['paths' => $rows]);
  }

  if ($method === 'GET' && isset($seg[0])) {
    $pid = (int)$seg[0];
    $p = db()->prepare('SELECT * FROM paths WHERE id = ?');
    $p->execute([$pid]);
    $path = $p->fetch();
    if (!$path) fail('not_found', 404);
    $path['lessons'] = lessons_with_status($pid, $user['id']);
    $done = count(array_filter($path['lessons'], fn($l) => $l['status'] === 'done'));
    $path['total'] = count($path['lessons']);
    $path['completed'] = $done;
    $path['percent'] = $path['total'] ? round($done * 100 / $path['total']) : 0;
    json_out(['path' => $path]);
  }

  fail('not_found', 404);
}

/** Ordered lessons with status: done / now / locked, plus source book title. */
function lessons_with_status($pid, $uid) {
  $stmt = db()->prepare(
    'SELECT l.id, l.idx, l.title, l.est_minutes, l.mission_line, l.source_book_id,
            b.title AS source_title,
            ul.status AS user_status
     FROM lessons l
     LEFT JOIN books b ON b.id = l.source_book_id
     LEFT JOIN user_lesson ul ON ul.lesson_id = l.id AND ul.user_id = ?
     WHERE l.path_id = ? ORDER BY l.idx, l.id');
  $stmt->execute([$uid, $pid]);
  $rows = $stmt->fetchAll();

  $firstIncomplete = null;
  foreach ($rows as $i => $r) {
    if (($r['user_status'] ?? '') !== 'done') { $firstIncomplete = $i; break; }
  }
  $out = [];
  foreach ($rows as $i => $r) {
    $status = 'locked';
    if (($r['user_status'] ?? '') === 'done') $status = 'done';
    elseif ($firstIncomplete !== null && $i <= $firstIncomplete) $status = 'now';
    $out[] = [
      'id'           => (int)$r['id'],
      'idx'          => (int)$r['idx'],
      'title'        => $r['title'],
      'est_minutes'  => (int)$r['est_minutes'],
      'mission_line' => $r['mission_line'],
      'source_title' => $r['source_title'],
      'status'       => $status,
    ];
  }
  return $out;
}
