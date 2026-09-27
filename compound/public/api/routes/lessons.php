<?php
/** A single lesson: insight cards, plus assignment template + user state. */

function route_lessons($method, $seg) {
  $user = require_user();
  $lid = (int)($seg[0] ?? 0);
  if (!$lid) fail('not_found', 404);

  // GET lessons/{id}
  if ($method === 'GET' && count($seg) === 1) {
    $l = db()->prepare(
      'SELECT l.*, b.title AS source_title, b.author AS source_author, p.title AS path_title
       FROM lessons l LEFT JOIN books b ON b.id = l.source_book_id
       JOIN paths p ON p.id = l.path_id WHERE l.id = ?');
    $l->execute([$lid]);
    $lesson = $l->fetch();
    if (!$lesson) fail('not_found', 404);

    $c = db()->prepare('SELECT idx, heading, body, quote, callout_title, callout_body, source_label FROM cards WHERE lesson_id = ? ORDER BY idx, id');
    $c->execute([$lid]);
    $lesson['cards'] = $c->fetchAll();

    $a = db()->prepare('SELECT title, instructions, examples, due_days FROM assignments WHERE lesson_id = ?');
    $a->execute([$lid]);
    $lesson['assignment'] = $a->fetch() ?: null;

    $qn = db()->prepare('SELECT COUNT(*) FROM quiz_questions WHERE lesson_id = ?');
    $qn->execute([$lid]);
    $lesson['quiz_count'] = (int)$qn->fetchColumn();

    // user state
    $us = db()->prepare('SELECT status FROM user_lesson WHERE user_id=? AND lesson_id=?');
    $us->execute([$user['id'], $lid]);
    $lesson['user_status'] = $us->fetchColumn() ?: null;

    // mark as started
    db()->prepare('INSERT IGNORE INTO user_lesson (user_id, lesson_id, status) VALUES (?,?,\'in_progress\')')
        ->execute([$user['id'], $lid]);

    json_out(['lesson' => $lesson]);
  }

  // POST lessons/{id}/complete  -> mark done, award insight points
  if ($method === 'POST' && ($seg[1] ?? '') === 'complete') {
    $us = db()->prepare('SELECT status FROM user_lesson WHERE user_id=? AND lesson_id=?');
    $us->execute([$user['id'], $lid]);
    $was = $us->fetchColumn();
    db()->prepare(
      'INSERT INTO user_lesson (user_id, lesson_id, status, completed_at) VALUES (?,?,\'done\',NOW())
       ON DUPLICATE KEY UPDATE status=\'done\', completed_at=IFNULL(completed_at, NOW())'
    )->execute([$user['id'], $lid]);
    // count insight cards for this lesson
    $cn = db()->prepare('SELECT COUNT(*) FROM cards WHERE lesson_id=?');
    $cn->execute([$lid]);
    $cards = (int)$cn->fetchColumn();
    if ($was !== 'done') touch_streak($user['id'], 15, $cards, 0); // +15 growth, +insights
    json_out(['ok' => true]);
  }

  fail('not_found', 404);
}
