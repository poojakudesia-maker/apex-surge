<?php
/**
 * Onboarding suggestions, before the learner has an account.
 *   POST suggest/outcomes {goal, role, level} -> outcome options written by Claude for that combination
 *
 * Public, so it is locked down: inputs must come from the onboarding lists (no free text reaches the
 * prompt), results are cached per combination for a day, and calls are rate limited per IP and overall.
 * The app falls back to its own per-goal options when this returns an error.
 */

const SUGGEST_GOALS  = ['Communication', 'Productivity', 'Interview Prep', 'Leadership', 'Confidence', 'Habits'];
const SUGGEST_ROLES  = ['Individual contributor', 'Manager / lead', 'Student', 'Job seeker', 'Founder', 'Just for me'];
const SUGGEST_LEVELS = ['Just starting', 'Some experience', 'Advanced'];

function route_suggest($method, $seg) {
  if ($method !== 'POST' || ($seg[0] ?? '') !== 'outcomes') fail('not_found', 404);
  $b = body_json();
  $goal = $b['goal'] ?? ''; $role = $b['role'] ?? ''; $level = $b['level'] ?? '';
  if (!in_array($goal, SUGGEST_GOALS, true) || !in_array($role, SUGGEST_ROLES, true) || !in_array($level, SUGGEST_LEVELS, true)) {
    fail('invalid_input');
  }
  if (!claude_configured()) fail('ai_unavailable', 503);

  $dir = sys_get_temp_dir() . '/leappath_suggest';
  @mkdir($dir, 0700, true);
  $file = $dir . '/' . md5($goal . '|' . $role . '|' . $level) . '.json';
  if (is_file($file) && time() - filemtime($file) < 86400) {
    $cached = json_decode((string)file_get_contents($file), true);
    if (is_array($cached)) json_out($cached);
  }

  $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
  if (!rate_ok('suggest:' . $ip, 20, 3600) || !rate_ok('suggest:all', 300, 3600)) fail('too_many_requests', 429);

  $schema = js_obj([
    'heading'    => js_str('Screen heading, under 7 words, e.g. "What does better focus look like?"'),
    'subheading' => js_str('One short line telling them to pick what matters most, under 14 words'),
    'outcomes'   => js_arr(js_obj([
      'label' => js_str('A concrete, observable outcome they want, starting with a verb, under 7 words'),
      'emoji' => js_str('One emoji that fits the outcome'),
    ]), 'Exactly six distinct outcomes, most common first'),
  ]);
  $system =
    "You write onboarding options for LeapPath, an app that turns book ideas into real-world practice. " .
    "Options must be specific to the person's goal, role and experience, concrete enough to practise and measure, " .
    "and written in plain, friendly English. No jargon, no duplicates.";
  $prompt = "Goal: $goal\nRole: $role\nExperience: $level\n\n" .
    "Write six outcomes this person is most likely to want from working on this goal, fitted to their role and experience. " .
    "Example style for a manager working on communication: \"Run meetings that end with decisions\".";
  $out = claude_json($system, $prompt, $schema, 2000, 'low');
  if (!$out || empty($out['outcomes'])) fail('ai_unavailable', 503);

  $clean = [
    'heading'    => mb_substr(trim($out['heading'] ?? ''), 0, 80),
    'subheading' => mb_substr(trim($out['subheading'] ?? ''), 0, 140),
    'outcomes'   => array_values(array_filter(array_map(fn($o) => [
      'label' => mb_substr(trim($o['label'] ?? ''), 0, 70),
      'emoji' => mb_substr(trim($o['emoji'] ?? ''), 0, 4),
    ], array_slice($out['outcomes'], 0, 6)), fn($o) => $o['label'] !== '')),
  ];
  if (!$clean['outcomes']) fail('ai_unavailable', 503);
  @file_put_contents($file, json_encode($clean, JSON_UNESCAPED_UNICODE), LOCK_EX);
  json_out($clean);
}
