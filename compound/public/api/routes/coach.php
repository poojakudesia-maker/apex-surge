<?php
/** Live AI coach powered by the Claude Messages API. */

function route_coach($method, $seg) {
  $user = require_user();

  // GET coach  -> recent history
  if ($method === 'GET' && empty($seg)) {
    $h = db()->prepare('SELECT role, content, created_at FROM coach_messages WHERE user_id = ? ORDER BY id DESC LIMIT 40');
    $h->execute([$user['id']]);
    $rows = array_reverse($h->fetchAll());
    json_out(['messages' => $rows]);
  }

  // POST coach  {message, context?}  -> Claude reply
  if ($method === 'POST' && empty($seg)) {
    $b = body_json();
    $msg = substr(trim($b['message'] ?? ''), 0, 4000);
    if ($msg === '') fail('empty_message');

    // profile for personalization
    $o = db()->prepare('SELECT goal, role, level, focus_areas FROM onboarding WHERE user_id = ?');
    $o->execute([$user['id']]);
    $prof = $o->fetch() ?: [];
    $focus = $prof ? implode(', ', json_decode($prof['focus_areas'] ?? '[]', true) ?: []) : '';

    $system =
      "You are the Compound Coach, a warm, sharp communication and growth coach inside a self-improvement app. " .
      "You help the user apply ideas from books like Never Split the Difference, Crucial Conversations, Made to Stick and Atomic Habits to real situations. " .
      "You can role-play difficult conversations (play the other person realistically, then break character to coach). " .
      "Keep replies short, concrete and encouraging — 2 to 5 sentences unless they ask for more. Give one clear next step. Never invent facts about the user.\n" .
      "User context — goal: " . ($prof['goal'] ?? 'Communication') .
      "; role: " . ($prof['role'] ?? 'unspecified') .
      "; level: " . ($prof['level'] ?? 'unspecified') .
      ($focus ? "; focus areas: $focus" : '') . ".";

    // last few turns for continuity
    $hist = db()->prepare('SELECT role, content FROM coach_messages WHERE user_id = ? ORDER BY id DESC LIMIT 10');
    $hist->execute([$user['id']]);
    $prev = array_reverse($hist->fetchAll());
    $messages = [];
    foreach ($prev as $p) $messages[] = ['role' => $p['role'], 'content' => $p['content']];
    $messages[] = ['role' => 'user', 'content' => $msg];

    // persist user message first
    db()->prepare('INSERT INTO coach_messages (user_id, role, content) VALUES (?,\'user\',?)')
        ->execute([$user['id'], $msg]);

    $res = claude_message($messages, $system, 700);
    if (!$res['ok']) {
      error_log('[coach] Claude API error: ' . $res['error']);
      $hint = $res['error'] === 'claude_not_configured'
        ? 'The AI coach is not configured yet. Add your Claude API key in api/config.php.'
        : 'The coach could not respond right now. Please try again in a moment.';
      json_out(['ok' => false, 'error' => $res['error'] === 'claude_not_configured' ? 'not_configured' : 'unavailable', 'reply' => $hint], 200);
    }

    db()->prepare('INSERT INTO coach_messages (user_id, role, content) VALUES (?,\'assistant\',?)')
        ->execute([$user['id'], $res['text']]);

    json_out(['ok' => true, 'reply' => $res['text']]);
  }

  // POST coach/reset -> clear history
  if ($method === 'POST' && ($seg[0] ?? '') === 'reset') {
    db()->prepare('DELETE FROM coach_messages WHERE user_id = ?')->execute([$user['id']]);
    json_out(['ok' => true]);
  }

  fail('not_found', 404);
}
