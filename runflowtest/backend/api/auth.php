<?php
/**
 * Authentication API Endpoints
 * POST /api/auth/register
 * POST /api/auth/verify
 * POST /api/auth/login
 * POST /api/auth/logout
 * GET  /api/auth/me
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db/Database.php';
require_once __DIR__ . '/../mail/EmailService.php';

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Helper functions
function sendJson($data, $status = 200) {
  http_response_code($status);
  echo json_encode($data);
  exit;
}

function getJsonInput() {
  return json_decode(file_get_contents('php://input'), true);
}

function getAuthHeader() {
  $headers = getallheaders();
  return $headers['Authorization'] ?? null;
}

function generateOTP() {
  return str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

function generateToken() {
  return bin2hex(random_bytes(32));
}

function validateEmail($email) {
  return filter_var($email, FILTER_VALIDATE_EMAIL);
}

function getCurrentUser() {
  $auth = getAuthHeader();
  if (!$auth) return null;

  $token = str_replace('Bearer ', '', $auth);
  $db = Database::getInstance();

  $session = $db->fetchOne(
    'SELECT * FROM sessions WHERE token = ? AND expires_at > ?',
    [$token, date('Y-m-d H:i:s')]
  );

  if (!$session) return null;

  return $db->fetchOne('SELECT id, email, email_verified FROM users WHERE id = ?', [$session['user_id']]);
}

// ============ Register ============
if ($action === 'register' && $method === 'POST') {
  $input = getJsonInput();
  $email = trim($input['email'] ?? '');
  $password = $input['password'] ?? '';

  // Validation
  if (!$email || !validateEmail($email)) {
    sendJson(['error' => 'Invalid email'], 400);
  }

  if (strlen($password) < 8) {
    sendJson(['error' => 'Password must be at least 8 characters'], 400);
  }

  // Check if email exists
  $existing = $db->fetchOne('SELECT id FROM users WHERE email = ?', [$email]);
  if ($existing) {
    sendJson(['error' => 'Email already registered'], 409);
  }

  // Create user
  $passwordHash = password_hash($password, PASSWORD_HASH_ALGO, PASSWORD_HASH_OPTIONS);
  $otp = generateOTP();
  $expiresAt = date('Y-m-d H:i:s', time() + DATA_TTL);

  try {
    $userId = $db->insert('users', [
      'email' => $email,
      'password_hash' => $passwordHash,
      'verification_code' => $otp,
      'verification_sent_at' => date('Y-m-d H:i:s'),
      'expires_at' => $expiresAt
    ]);

    // Send verification email
    EmailService::sendVerificationCode($email, $otp);

    sendJson([
      'message' => 'Registration successful. Check your email for verification code.',
      'user_id' => $userId
    ], 201);
  } catch (Exception $e) {
    sendJson(['error' => 'Registration failed'], 500);
  }
}

// ============ Verify Email ============
if ($action === 'verify' && $method === 'POST') {
  $input = getJsonInput();
  $email = trim($input['email'] ?? '');
  $code = trim($input['code'] ?? '');

  if (!$email || !$code) {
    sendJson(['error' => 'Email and code required'], 400);
  }

  $user = $db->fetchOne('SELECT id, verification_code FROM users WHERE email = ?', [$email]);

  if (!$user) {
    sendJson(['error' => 'User not found'], 404);
  }

  if ($user['verification_code'] !== $code) {
    sendJson(['error' => 'Invalid verification code'], 400);
  }

  // Verify email
  $db->update('users', [
    'email_verified' => 1,
    'verification_code' => null
  ], 'id = ?', [$user['id']]);

  sendJson(['message' => 'Email verified successfully'], 200);
}

// ============ Login ============
if ($action === 'login' && $method === 'POST') {
  $input = getJsonInput();
  $email = trim($input['email'] ?? '');
  $password = $input['password'] ?? '';

  if (!$email || !$password) {
    sendJson(['error' => 'Email and password required'], 400);
  }

  $user = $db->fetchOne('SELECT id, password_hash, email_verified FROM users WHERE email = ?', [$email]);

  if (!$user || !password_verify($password, $user['password_hash'])) {
    sendJson(['error' => 'Invalid credentials'], 401);
  }

  if (!$user['email_verified']) {
    sendJson(['error' => 'Email not verified'], 403);
  }

  // Create session
  $token = generateToken();
  $expiresAt = date('Y-m-d H:i:s', time() + SESSION_TTL);

  $db->insert('sessions', [
    'user_id' => $user['id'],
    'token' => $token,
    'ip_address' => $_SERVER['REMOTE_ADDR'],
    'user_agent' => $_SERVER['HTTP_USER_AGENT'],
    'expires_at' => $expiresAt
  ]);

  // Extend user expiration
  $db->update('users', [
    'expires_at' => $expiresAt,
    'last_activity' => date('Y-m-d H:i:s')
  ], 'id = ?', [$user['id']]);

  sendJson([
    'message' => 'Login successful',
    'token' => $token,
    'email' => $email
  ], 200);
}

// ============ Logout ============
if ($action === 'logout' && $method === 'POST') {
  $auth = getAuthHeader();
  if (!$auth) {
    sendJson(['error' => 'Unauthorized'], 401);
  }

  $token = str_replace('Bearer ', '', $auth);
  $db->delete('sessions', 'token = ?', [$token]);

  sendJson(['message' => 'Logout successful'], 200);
}

// ============ Get Current User ============
if ($action === 'me' && $method === 'GET') {
  $user = getCurrentUser();

  if (!$user) {
    sendJson(['error' => 'Unauthorized'], 401);
  }

  sendJson($user, 200);
}

// Invalid endpoint
sendJson(['error' => 'Invalid endpoint'], 404);
