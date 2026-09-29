<?php
/** Save the onboarding profile and pick the user's path. */

function route_onboarding($method, $seg) {
  $user = require_user();

  if ($method === 'GET') {
    $s = db()->prepare('SELECT * FROM onboarding WHERE user_id = ?');
    $s->execute([$user['id']]);
    $o = $s->fetch() ?: null;
    if ($o) $o['focus_areas'] = json_decode($o['focus_areas'] ?: '[]', true);
    json_out(['onboarding' => $o]);
  }

  if ($method === 'POST') {
    $b = body_json();
    $goal    = substr(trim($b['goal'] ?? 'Communication'), 0, 60);
    $focus   = is_array($b['focus_areas'] ?? null) ? array_slice($b['focus_areas'], 0, 12) : [];
    $target  = substr(trim($b['target'] ?? '30d'), 0, 20);
    $role    = substr(trim($b['role'] ?? ''), 0, 60);
    $level   = substr(trim($b['level'] ?? ''), 0, 30);
    $minutes = (int)($b['daily_minutes'] ?? 10);
    $format  = substr(trim($b['format'] ?? 'both'), 0, 20);

    db()->prepare(
      'INSERT INTO onboarding (user_id, goal, focus_areas, target, role, level, daily_minutes, format)
       VALUES (:u,:g,:f,:t,:r,:l,:m,:fmt)
       ON DUPLICATE KEY UPDATE goal=:g2, focus_areas=:f2, target=:t2, role=:r2, level=:l2, daily_minutes=:m2, format=:fmt2'
    )->execute([
      ':u'=>$user['id'], ':g'=>$goal, ':f'=>json_encode(array_values($focus)), ':t'=>$target,
      ':r'=>$role, ':l'=>$level, ':m'=>$minutes, ':fmt'=>$format,
      ':g2'=>$goal, ':f2'=>json_encode(array_values($focus)), ':t2'=>$target,
      ':r2'=>$role, ':l2'=>$level, ':m2'=>$minutes, ':fmt2'=>$format,
    ]);

    // pick a path matching the goal, else the first path
    $p = db()->prepare('SELECT id, slug FROM paths WHERE goal = ? ORDER BY id LIMIT 1');
    $p->execute([$goal]);
    $path = $p->fetch();
    if (!$path) { $path = db()->query('SELECT id, slug FROM paths ORDER BY id LIMIT 1')->fetch(); }

    // with Claude configured the app builds a personal plan next (POST plan/build)
    json_out(['ok' => true, 'path' => $path, 'ai' => claude_configured()]);
  }

  fail('method_not_allowed', 405);
}
