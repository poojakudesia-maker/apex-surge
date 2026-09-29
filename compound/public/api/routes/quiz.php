<?php
/** Quiz: fetch questions, grade a single answer instantly, submit final score. */

function route_quiz($method, $seg) {
  $user = require_user();

  // GET quiz/{lessonId}  -> questions + options (no correct flags leaked)
  if ($method === 'GET' && isset($seg[0]) && ctype_digit($seg[0])) {
    $lid = (int)$seg[0];
    require_lesson_access($lid, $user['id']);
    $qs = db()->prepare('SELECT id, question FROM quiz_questions WHERE lesson_id = ? ORDER BY idx, id');
    $qs->execute([$lid]);
    $questions = $qs->fetchAll();
    $optStmt = db()->prepare('SELECT id, label FROM quiz_options WHERE question_id = ? ORDER BY idx, id');
    foreach ($questions as &$q) {
      $optStmt->execute([$q['id']]);
      $q['id'] = (int)$q['id'];
      $q['options'] = array_map(fn($o) => ['id' => (int)$o['id'], 'label' => $o['label']], $optStmt->fetchAll());
    }
    json_out(['questions' => $questions]);
  }

  // POST quiz/answer  {question_id, option_id}  -> instant verdict
  if ($method === 'POST' && ($seg[0] ?? '') === 'answer') {
    $b = body_json();
    $qid = (int)($b['question_id'] ?? 0);
    $oid = (int)($b['option_id'] ?? 0);
    $q = db()->prepare('SELECT explanation, lesson_id FROM quiz_questions WHERE id = ?');
    $q->execute([$qid]);
    $qq = $q->fetch();
    if (!$qq) fail('not_found', 404);
    require_lesson_access($qq['lesson_id'], $user['id']);
    $c = db()->prepare('SELECT id, is_correct FROM quiz_options WHERE question_id = ?');
    $c->execute([$qid]);
    $correctId = null; $picked = false; $isCorrect = false;
    foreach ($c->fetchAll() as $o) {
      if ($o['is_correct']) $correctId = (int)$o['id'];
      if ((int)$o['id'] === $oid && $o['is_correct']) $isCorrect = true;
      if ((int)$o['id'] === $oid) $picked = true;
    }
    if (!$picked) fail('invalid_option');
    json_out(['correct' => $isCorrect, 'correct_option_id' => $correctId, 'explanation' => $qq['explanation']]);
  }

  // POST quiz/{lessonId}/submit  {answers: {question_id: option_id}}
  if ($method === 'POST' && isset($seg[0]) && ctype_digit($seg[0]) && ($seg[1] ?? '') === 'submit') {
    $lid = (int)$seg[0];
    require_lesson_access($lid, $user['id']);
    $b = body_json();
    $answers = is_array($b['answers'] ?? null) ? $b['answers'] : [];
    $st = db()->prepare('SELECT id FROM quiz_questions WHERE lesson_id = ?');
    $st->execute([$lid]);
    $qs = $st->fetchAll(PDO::FETCH_COLUMN);
    $total = count($qs);
    $score = 0;
    $correctStmt = db()->prepare('SELECT id FROM quiz_options WHERE question_id = ? AND is_correct = 1 LIMIT 1');
    foreach ($qs as $qid) {
      $correctStmt->execute([$qid]);
      $cid = (int)$correctStmt->fetchColumn();
      if (isset($answers[$qid]) && (int)$answers[$qid] === $cid) $score++;
    }
    db()->prepare('INSERT INTO user_quiz (user_id, lesson_id, score, total) VALUES (?,?,?,?)')
        ->execute([$user['id'], $lid, $score, $total]);
    touch_streak($user['id'], $score * 2, 0, 0); // small growth for quiz performance
    json_out(['score' => $score, 'total' => $total]);
  }

  fail('not_found', 404);
}
