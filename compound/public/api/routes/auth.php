<?php
/** Passwordless auth: email -> 6-digit code -> bearer token. */

function route_auth($method, $seg) {
  $action = $seg[0] ?? '';

  if ($action === 'request-code' && $method === 'POST') return auth_request_code();
  if ($action === 'verify-code'  && $method === 'POST') return auth_verify_code();
  if ($action === 'me'           && $method === 'GET')  return auth_me();
  if ($action === 'logout'       && $method === 'POST') return auth_logout();

  fail('not_found', 404);
}

function auth_request_code() {
  $b = body_json();
  $email = valid_email($b['email'] ?? '');
  if (!$email) fail('invalid_email');

  // basic abuse protection: 5 requests / 15 min per email + per IP
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0';
  if (!rate_ok('code:' . $email, 5, 900) || !rate_ok('ip:' . $ip, 20, 900)) {
    fail('too_many_requests', 429);
  }

  $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
  $ttl  = (int)cfg('code_ttl_min');
  db()->prepare(
    'INSERT INTO login_codes (email, code_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))'
  )->execute([$email, hash('sha256', $code), $ttl]);

  $sent = send_login_email($email, $code);

  $out = ['sent' => $sent];
  if (cfg('dev_echo_code')) $out['dev_code'] = $code; // TEST ONLY
  json_out($out);
}

function auth_verify_code() {
  $b = body_json();
  $email = valid_email($b['email'] ?? '');
  $code  = preg_replace('/\D/', '', (string)($b['code'] ?? ''));
  if (!$email || strlen($code) !== 6) fail('invalid_input');

  $stmt = db()->prepare(
    'SELECT * FROM login_codes WHERE email = ? AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1');
  $stmt->execute([$email]);
  $row = $stmt->fetch();
  if (!$row) fail('code_expired', 410);
  if ((int)$row['attempts'] >= 6) fail('too_many_attempts', 429);

  if (!hash_equals($row['code_hash'], hash('sha256', $code))) {
    db()->prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?')->execute([$row['id']]);
    fail('wrong_code', 401);
  }
  db()->prepare('UPDATE login_codes SET consumed_at = NOW() WHERE id = ?')->execute([$row['id']]);

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

// ---- helpers ----
function public_user($u) {
  return [
    'id'           => (int)$u['id'],
    'email'        => $u['email'],
    'display_name' => $u['display_name'],
    'is_admin'     => (bool)$u['is_admin'] || in_array(strtolower($u['email']), array_map('strtolower', cfg('admin_emails') ?: []), true),
  ];
}

function db_onboarded($uid) {
  $s = db()->prepare('SELECT 1 FROM onboarding WHERE user_id = ? AND goal IS NOT NULL');
  $s->execute([$uid]);
  return (bool)$s->fetchColumn();
}

function send_login_email($email, $code) {
  $m = cfg('mail');
  $subject = 'Your Compound sign-in code: ' . $code;
  $body =
    "Hi,\r\n\r\nYour Compound sign-in code is: $code\r\n\r\n" .
    "It expires in " . (int)cfg('code_ttl_min') . " minutes. If you did not request this, ignore this email.\r\n\r\n— Compound";
  $headers =
    'From: ' . ($m['from_name'] ?? 'Compound') . ' <' . ($m['from'] ?? 'no-reply@localhost') . ">\r\n" .
    'Reply-To: ' . ($m['from'] ?? 'no-reply@localhost') . "\r\n" .
    "Content-Type: text/plain; charset=UTF-8\r\n" .
    'X-Mailer: PHP/' . phpversion();
  // @ to avoid leaking warnings into JSON; return value tells the client if it left the box.
  return @mail($email, $subject, $body, $headers);
}
