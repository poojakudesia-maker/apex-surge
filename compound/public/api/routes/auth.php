<?php
/** Passwordless auth: email -> 6-digit code -> bearer token. */
require_once __DIR__ . '/../mailer.php';

const MAX_CODE_ATTEMPTS = 5;

function route_auth($method, $seg) {
  $action = $seg[0] ?? '';

  if ($action === 'request-code' && $method === 'POST') return auth_request_code();
  if ($action === 'verify-code'  && $method === 'POST') return auth_verify_code();
  if ($action === 'me'           && $method === 'GET')  return auth_me();
  if ($action === 'logout'       && $method === 'POST') return auth_logout();
  if ($action === 'logout-all'   && $method === 'POST') return auth_logout_all();
  if ($action === 'profile'      && $method === 'POST') return auth_profile();

  fail('not_found', 404);
}

function auth_request_code() {
  $b = body_json();
  $email = valid_email($b['email'] ?? '');
  if (!$email) fail('invalid_email');

  // abuse protection: 1 send / 60 s and 5 / 15 min per email, 20 / 15 min per IP
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
  if (!rate_ok('cool:' . $email, 1, 60)) json_out(['error' => 'too_many_requests', 'retry_after' => 60], 429);
  if (!rate_ok('code:' . $email, 5, 900) || !rate_ok('ip:' . $ip, 20, 900)) {
    json_out(['error' => 'too_many_requests', 'retry_after' => 900], 429);
  }

  // only the newest code is ever valid
  db()->prepare('UPDATE login_codes SET consumed_at = NOW() WHERE email = ? AND consumed_at IS NULL')->execute([$email]);

  $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  $ttl  = (int)cfg('code_ttl_min');
  db()->prepare(
    'INSERT INTO login_codes (email, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))'
  )->execute([$email, hash('sha256', $code), $ttl]);
  $code_id = db()->lastInsertId();

  if (!send_login_email($email, $code)) {
    db()->prepare('UPDATE login_codes SET consumed_at = NOW() WHERE id = ?')->execute([$code_id]);
    fail('email_send_failed', 502);
  }
  json_out(['sent' => true, 'expires_in_min' => $ttl]);
}

function auth_verify_code() {
  $b = body_json();
  $email = valid_email($b['email'] ?? '');
  $code  = preg_replace('/\D/', '', (string)($b['code'] ?? ''));
  if (!$email || strlen($code) !== 6) fail('invalid_input');

  $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
  if (!rate_ok('verify-ip:' . $ip, 30, 900)) fail('too_many_requests', 429);

  $stmt = db()->prepare(
    'SELECT * FROM login_codes WHERE email = ? AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1');
  $stmt->execute([$email]);
  $row = $stmt->fetch();
  if (!$row) fail('code_expired', 410);

  if (!hash_equals($row['code_hash'], hash('sha256', $code))) {
    $left = MAX_CODE_ATTEMPTS - ((int)$row['attempts'] + 1);
    // burn the code after too many wrong guesses; the user must request a new one
    db()->prepare('UPDATE login_codes SET attempts = attempts + 1, consumed_at = IF(?, NOW(), NULL) WHERE id = ?')
      ->execute([$left <= 0 ? 1 : 0, $row['id']]);
    if ($left <= 0) fail('too_many_attempts', 429);
    json_out(['error' => 'wrong_code', 'attempts_left' => $left], 401);
  }
  db()->prepare('UPDATE login_codes SET consumed_at = NOW() WHERE email = ? AND consumed_at IS NULL')->execute([$email]);

  // find or create user
  $u = db()->prepare('SELECT * FROM users WHERE email = ?');
  $u->execute([$email]);
  $user = $u->fetch();
  $is_new = false;
  if (!$user) {
    $admins = array_map('strtolower', cfg('admin_emails') ?: []);
    $is_admin = in_array($email, $admins, true) ? 1 : 0;
    db()->prepare('INSERT INTO users (email, is_admin) VALUES (?, ?)')->execute([$email, $is_admin]);
    $id = db()->lastInsertId();
    db()->prepare('INSERT IGNORE INTO user_stats (user_id) VALUES (?)')->execute([$id]);
    $u->execute([$email]); $user = $u->fetch();
    $is_new = true;
  }

  // issue session
  $token = random_token();
  $days  = (int)cfg('session_ttl_days');
  db()->prepare(
    'INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))'
  )->execute([$user['id'], hash('sha256', $token), $days]);

  $onboarded = (bool) db_onboarded($user['id']);
  json_out([
    'token'     => $token,
    'is_new'    => $is_new,
    'onboarded' => $onboarded,
    'user'      => public_user($user),
  ]);
}

function auth_me() {
  $user = require_user();
  $ob = db()->prepare('SELECT * FROM onboarding WHERE user_id = ?');
  $ob->execute([$user['id']]);
  $onb = $ob->fetch() ?: null;
  if ($onb && isset($onb['focus_areas'])) $onb['focus_areas'] = json_decode($onb['focus_areas'] ?: '[]', true);
  json_out([
    'user'       => public_user($user),
    'onboarded'  => (bool)$onb,
    'onboarding' => $onb,
  ]);
}

function auth_logout() {
  require_user();
  $token = bearer_token();
  if ($token) db()->prepare('DELETE FROM sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
  json_out(['ok' => true]);
}

/** Sign out everywhere: removes every session for this user. */
function auth_logout_all() {
  $user = require_user();
  db()->prepare('DELETE FROM sessions WHERE user_id = ?')->execute([$user['id']]);
  json_out(['ok' => true]);
}

/** Update the learner's display name. */
function auth_profile() {
  $user = require_user();
  $b = body_json();
  $name = trim(preg_replace('/\s+/', ' ', (string)($b['display_name'] ?? '')));
  $name = mb_substr(strip_tags($name), 0, 60);
  db()->prepare('UPDATE users SET display_name = ? WHERE id = ?')->execute([$name === '' ? null : $name, $user['id']]);
  $u = db()->prepare('SELECT * FROM users WHERE id = ?');
  $u->execute([$user['id']]);
  json_out(['user' => public_user($u->fetch())]);
}

// ---- helpers ----
function public_user($u) {
  return [
    'id'           => (int)$u['id'],
    'email'        => $u['email'],
    'display_name' => $u['display_name'],
    'member_since' => $u['created_at'] ?? null,
    'is_admin'     => (bool)$u['is_admin'] || in_array(strtolower($u['email']), array_map('strtolower', cfg('admin_emails') ?: []), true),
  ];
}

function db_onboarded($uid) {
  $s = db()->prepare('SELECT 1 FROM onboarding WHERE user_id = ? AND goal IS NOT NULL');
  $s->execute([$uid]);
  return (bool)$s->fetchColumn();
}

function send_login_email($email, $code) {
  $ttl = (int)cfg('code_ttl_min');
  $app = APP_NAME;
  $subject = $code . ' is your ' . $app . ' sign-in code';
  $text =
    "Your $app sign-in code is: $code\r\n\r\n" .
    "Enter it in the app to continue. It expires in $ttl minutes.\r\n\r\n" .
    "If you didn't request this, you can ignore this email.\r\n";
  $a = htmlspecialchars($app, ENT_QUOTES);
  $html =
    '<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f7;font-family:Arial,Helvetica,sans-serif;color:#1c1c1e">' .
    '<table role="presentation" width="100%" style="max-width:440px;margin:0 auto;background:#fff;border-radius:12px;padding:28px">' .
    '<tr><td><p style="margin:0 0 16px;font-size:16px">Your ' . $a . ' sign-in code:</p>' .
    '<p style="margin:0 0 16px;font-size:34px;font-weight:bold;letter-spacing:8px;color:#6242F5">' . $code . '</p>' .
    '<p style="margin:0 0 8px;font-size:14px;color:#555">Enter it in the app to continue. It expires in ' . $ttl . ' minutes.</p>' .
    '<p style="margin:0;font-size:13px;color:#888">If you didn\'t request this, you can ignore this email.</p>' .
    '</td></tr></table></body></html>';
  return send_mail($email, $subject, $text, $html);
}
