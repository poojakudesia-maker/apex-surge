<?php
/** Shared helpers: JSON I/O, auth, CORS, small utilities. */

function send_cors() {
  $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
  // Same-origin app needs no CORS; allow it anyway for local testing tools.
  header('Access-Control-Allow-Origin: ' . ($origin ?: '*'));
  header('Vary: Origin');
  header('Access-Control-Allow-Headers: Content-Type, Authorization');
  header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
  header('Access-Control-Allow-Credentials: true');
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }
}

function json_out($data, $code = 200) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function fail($msg, $code = 400) { json_out(['error' => $msg], $code); }

function body_json() {
  static $b = null;
  if ($b !== null) return $b;
  $raw = file_get_contents('php://input');
  $b = json_decode($raw, true);
  if (!is_array($b)) $b = [];
  return $b;
}

function bearer_token() {
  // after a mod_rewrite pass Apache/LiteSpeed expose it as REDIRECT_HTTP_AUTHORIZATION
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
  if (!$h && function_exists('apache_request_headers')) {
    $hh = apache_request_headers();
    $h = $hh['Authorization'] ?? ($hh['authorization'] ?? '');
  }
  if (preg_match('/Bearer\s+(.+)/i', $h, $m)) return trim($m[1]);
  return null;
}

/** Returns the authenticated user row, or null. */
function current_user_opt() {
  static $cached = false, $user = null;
  if ($cached) return $user;
  $cached = true;
  $token = bearer_token();
  if (!$token) return $user = null;
  $hash = hash('sha256', $token);
  $stmt = db()->prepare(
    'SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW() LIMIT 1');
  $stmt->execute([$hash]);
  $user = $stmt->fetch() ?: null;
  if ($user) {
    db()->prepare('UPDATE sessions SET last_used_at = NOW() WHERE token_hash = ?')->execute([$hash]);
    db()->prepare('UPDATE users SET last_seen_at = NOW() WHERE id = ?')->execute([$user['id']]);
  }
  return $user;
}

/** Require auth or 401. */
function require_user() {
  $u = current_user_opt();
  if (!$u) fail('unauthorized', 401);
  return $u;
}

function require_admin() {
  $u = require_user();
  $admins = array_map('strtolower', cfg('admin_emails') ?: []);
  if (!$u['is_admin'] && !in_array(strtolower($u['email']), $admins, true)) {
    fail('forbidden', 403);
  }
  return $u;
}

function random_token($bytes = 32) { return bin2hex(random_bytes($bytes)); }

function valid_email($e) { return filter_var($e, FILTER_VALIDATE_EMAIL) ? strtolower(trim($e)) : null; }

/** Ensure a user_stats row exists; return it. */
function ensure_stats($uid) {
  db()->prepare('INSERT IGNORE INTO user_stats (user_id) VALUES (?)')->execute([$uid]);
  $s = db()->prepare('SELECT * FROM user_stats WHERE user_id = ?');
  $s->execute([$uid]);
  return $s->fetch();
}

/** Bump streak + growth score when the user does something meaningful today. */
function touch_streak($uid, $growth = 0, $insights = 0, $actions = 0) {
  $s = ensure_stats($uid);
  $today = date('Y-m-d');
  $streak = (int)$s['streak'];
  if ($s['last_active_date'] !== $today) {
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $streak = ($s['last_active_date'] === $yesterday) ? $streak + 1 : 1;
  }
  db()->prepare(
    'UPDATE user_stats SET streak = ?, last_active_date = ?, growth_score = growth_score + ?,
       insights_learned = insights_learned + ?, actions_done = actions_done + ? WHERE user_id = ?'
  )->execute([$streak, $today, $growth, $insights, $actions, $uid]);
}

/** Very light per-key rate limit using login_codes/sessions timestamps is overkill;
 *  keep a tiny file-based limiter for the code-request endpoint. */
function rate_ok($key, $max, $window_sec) {
  $dir = sys_get_temp_dir() . '/compound_rl';
  @mkdir($dir, 0700, true);
  $file = $dir . '/' . md5($key);
  $now = time();
  $hits = [];
  if (is_file($file)) $hits = array_filter(explode(',', trim(file_get_contents($file))), 'strlen');
  $hits = array_filter($hits, fn($t) => ($now - (int)$t) < $window_sec);
  if (count($hits) >= $max) return false;
  $hits[] = $now;
  @file_put_contents($file, implode(',', $hits), LOCK_EX);
  return true;
}

/** Lessons on a personal (AI) path belong to that learner only. 404s otherwise. */
function require_lesson_access($lid, $uid) {
  $s = db()->prepare('SELECT p.user_id FROM lessons l JOIN paths p ON p.id = l.path_id WHERE l.id = ?');
  $s->execute([(int)$lid]);
  $owner = $s->fetch();
  if (!$owner || ($owner['user_id'] !== null && (int)$owner['user_id'] !== (int)$uid)) fail('not_found', 404);
}
