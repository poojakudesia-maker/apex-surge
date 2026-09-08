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

$action = $_GET['action'] ?? '';

if ($action === 'register') {
    $in = json_input();
    $email = trim(strtolower($in['email'] ?? ''));
    $password = (string) ($in['password'] ?? '');
    $displayName = trim($in['displayName'] ?? '');
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) json_error('Please enter a valid email address.');
    if (strlen($password) < 8) json_error('Password must be at least 8 characters.');

    $pdo = db();
    $exists = $pdo->prepare('SELECT id FROM users WHERE email = ?');
    $exists->execute([$email]);
    if ($exists->fetch()) json_error('An account with that email already exists.', 409);

    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)');
    $stmt->execute([$email, $hash, $displayName ?: explode('@', $email)[0]]);
    $userId = (int) $pdo->lastInsertId();

    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;

    $row = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $row->execute([$userId]);
    json_out(['user' => user_public_row($row->fetch())]);
}

if ($action === 'login') {
    $in = json_input();
    $email = trim(strtolower($in['email'] ?? ''));
    $password = (string) ($in['password'] ?? '');

    $pdo = db();
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($password, $row['password_hash'])) {
        json_error('Incorrect email or password.', 401);
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
