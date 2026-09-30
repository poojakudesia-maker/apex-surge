<?php
/**
 * RunFlowTest Configuration
 */

// Environment
define('ENV', getenv('APP_ENV') ?: 'production');
define('DEBUG', ENV === 'development');

// Database Configuration
define('DB_TYPE', getenv('DB_TYPE') ?: 'sqlite'); // sqlite or mysql
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'runflowtest');
define('DB_PATH', __DIR__ . '/../data/runflowtest.db'); // For SQLite

// Email Configuration
define('MAIL_DRIVER', getenv('MAIL_DRIVER') ?: 'smtp');
define('MAIL_HOST', getenv('MAIL_HOST') ?: 'smtp.gmail.com');
define('MAIL_PORT', getenv('MAIL_PORT') ?: 587);
define('MAIL_USER', getenv('MAIL_USER') ?: 'your-email@gmail.com');
define('MAIL_PASS', getenv('MAIL_PASS') ?: 'your-app-password');
define('MAIL_FROM', getenv('MAIL_FROM') ?: 'noreply@runflowtest.com');
define('MAIL_FROM_NAME', 'RunFlowTest');

// API Configuration
define('API_URL', getenv('API_URL') ?: 'http://localhost:8000/api');
define('FRONTEND_URL', getenv('FRONTEND_URL') ?: 'http://localhost:3000');

// Session Configuration
define('SESSION_NAME', 'runflowtest_session');
define('SESSION_TTL', 3600 * 20); // 20 hours in seconds
define('SESSION_LIFETIME', SESSION_TTL);

// Data Retention (20 hours)
define('DATA_TTL', 3600 * 20); // seconds

// Security
define('JWT_SECRET', getenv('JWT_SECRET') ?: 'your-super-secret-key-change-in-production');
define('PASSWORD_HASH_ALGO', PASSWORD_BCRYPT);
define('PASSWORD_HASH_OPTIONS', ['cost' => 12]);

// CORS
define('CORS_ORIGINS', ['http://localhost:3000', 'https://poojakudesia.in', 'https://runflowtest.poojakudesia.in']);

// Error Handling
error_reporting(DEBUG ? E_ALL : 0);
ini_set('display_errors', DEBUG ? '1' : '0');
ini_set('log_errors', '1');
ini_set('error_log', __DIR__ . '/../logs/error.log');

// Headers
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 1; mode=block');

// CORS Headers
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, CORS_ORIGINS)) {
  header("Access-Control-Allow-Origin: $origin");
  header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  http_response_code(200);
  exit;
}

// Timezone
date_default_timezone_set('UTC');
