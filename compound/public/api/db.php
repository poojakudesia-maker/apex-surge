<?php
/** PDO connection singleton. */
function db() {
  static $pdo = null;
  if ($pdo !== null) return $pdo;
  $cfg = require __DIR__ . '/config.php';
  $d = $cfg['db'];
  $dsn = "mysql:host={$d['host']};dbname={$d['name']};charset={$d['charset']}";
  try {
    $pdo = new PDO($dsn, $d['user'], $d['pass'], [
      PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
      PDO::ATTR_EMULATE_PREPARES   => false,
    ]);
  } catch (PDOException $e) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'db_connection_failed']);
    exit;
  }
  return $pdo;
}

function cfg($key = null) {
  static $cfg = null;
  if ($cfg === null) $cfg = require __DIR__ . '/config.php';
  return $key === null ? $cfg : ($cfg[$key] ?? null);
}
