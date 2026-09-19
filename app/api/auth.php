<?php
require_once __DIR__ . '/helpers.php';
ini_session();

function user_public_row(array $row): array {
    return [
        'id' => (int) $row['id'],
        'email' => $row['email'],
        'displayName' => $row['display_name'],
        'onboarding' => $row['onboarding_complete'] ? [
            'why' => $row['onboarding_why'],
            'areas' => json_decode($row['onboarding_areas'] ?? '[]', true) ?: [],
            'challenge' => $row['onboarding_challenge'],
            'time' => (int) $row['onboarding_time'],
            'style' => $row['onboarding_style'],
        ] : null,
        'onboardingComplete' => (bool) $row['onboarding_complete'],
        'journeyTitle' => $row['journey_title'],
        'growthScore' => (int) $row['growth_score'],
        'streak' => (int) $row['streak'],
        'lastActiveDate' => $row['last_active_date'],
    ];
}

/** Sends the 6-digit verification code. Uses PHP's built-in mail() — no
 * extra service/config needed. Deliverability on shared hosting varies;
 * if codes land in spam, an SMTP-based mailer can replace this function
 * later without touching anything else. */
function send_verification_email(string $email, string $code): void {
    $subject = 'Your Apex Surge verification code';
    $body = "Your verification code is: $code\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.";
    $headers = 'From: no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'apexsurge.app');
    @mail($email, $subject, $body, $headers);
}

$action = $_GET['action'] ?? '';

// Step 1 of signup: validate + hold everything in the session, email a code.
// Nothing is written to the database yet — the account is only created once
// the code is confirmed, so no DB schema change was needed for any of this.
if ($action === 'signupStart') {
    $in = json_input();
    $email = trim(strtolower($in['email'] ?? ''));
    $pin = (string) ($in['pin'] ?? '');
    $displayName = trim($in['displayName'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Please enter a valid email address.');
    if (!preg_match('/^\d{4}$/', $pin)) json_error('Your PIN must be exactly 4 digits.');

    $pdo = db();
    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) json_error('An account with that email already exists.', 409);

    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $_SESSION['pending_signup'] = [
        'email' => $email,
        'displayName' => $displayName ?: explode('@', $email)[0],
        'pinHash' => password_hash($pin, PASSWORD_DEFAULT),
        'code' => $code,
        'expires' => time() + 600,
    ];
    send_verification_email($email, $code);
    json_out(['ok' => true, 'email' => $email]);
}

if ($action === 'signupResend') {
    $pending = $_SESSION['pending_signup'] ?? null;
    if (!$pending) json_error('Start signup again — nothing pending.', 400);
    $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
    $pending['code'] = $code;
    $pending['expires'] = time() + 600;
    $_SESSION['pending_signup'] = $pending;
    send_verification_email($pending['email'], $code);
    json_out(['ok' => true]);
}

// Step 2 of signup: confirm the code -> create the account for real.
if ($action === 'signupVerify') {
    $in = json_input();
    $code = trim((string) ($in['code'] ?? ''));
    $pending = $_SESSION['pending_signup'] ?? null;
    if (!$pending) json_error('Start signup again — nothing pending.', 400);
    if (time() > $pending['expires']) { unset($_SESSION['pending_signup']); json_error('That code expired. Please start signup again.', 400); }
    if (!hash_equals($pending['code'], $code)) json_error('Incorrect code. Please try again.', 401);

    $pdo = db();
    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)');
    $stmt->execute([$pending['email'], $pending['pinHash'], $pending['displayName']]);
    $userId = (int) $pdo->lastInsertId();
    unset($_SESSION['pending_signup']);

    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;

    $row = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $row->execute([$userId]);
    json_out(['user' => user_public_row($row->fetch())]);
}

// Ordinary login: email + 4-digit PIN. The PIN is stored (hashed) in the
// same password_hash column a password used to live in — same column,
// same password_hash()/password_verify() calls, just digits instead of text.
if ($action === 'login') {
    $in = json_input();
    $email = trim(strtolower($in['email'] ?? ''));
    $pin = (string) ($in['pin'] ?? '');

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($pin, $row['password_hash'])) {
        json_error('Incorrect email or PIN.', 401);
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $row['id'];
    json_out(['user' => user_public_row($row)]);
}

if ($action === 'logout') {
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}

if ($action === 'me') {
    if (empty($_SESSION['user_id'])) json_error('Not signed in.', 401);
    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch();
    if (!$row) json_error('Not signed in.', 401);
    json_out(['user' => user_public_row($row)]);
}

json_error('Unknown action.', 404);
