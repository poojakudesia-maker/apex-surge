<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

// Never leak stack traces to the client — log them server-side, return clean JSON.
ini_set('display_errors', '0');
set_exception_handler(function (Throwable $e) {
    error_log((string) $e);
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
    exit;
});

// Same-origin app (Hostinger serves app + api from one domain), so a
// permissive CORS header is unnecessary — the session cookie only ever
// travels between the browser and this same host.

function ini_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 60 * 60 * 24 * 30,
            'path' => '/',
            'secure' => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

function json_input(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function json_out($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_out(['error' => $message], $status);
}

/** Returns the logged-in user's id, or sends a 401 and exits. */
function require_user(): int {
    ini_session();
    if (empty($_SESSION['user_id'])) {
        json_error('Sign in required.', 401);
    }
    return (int) $_SESSION['user_id'];
}

function today_str(): string {
    return date('Y-m-d');
}

function clamp_score(int $n): int {
    return max(0, min(100, $n));
}
