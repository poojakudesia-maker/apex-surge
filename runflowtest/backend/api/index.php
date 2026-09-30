<?php
/**
 * RunFlowTest API Router
 * Route all requests to appropriate handlers
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db/Database.php';

// Parse URL
$request = $_SERVER['REQUEST_URI'];
$request = str_replace('/api/', '', $request);
$parts = explode('?', $request)[0];
$segments = array_filter(explode('/', $parts));

// Initialize database
$db = Database::getInstance();
$db->initDatabase();

// Run cleanup every hour
$lastCleanup = apcu_fetch('last_cleanup');
if ($lastCleanup === false || (time() - $lastCleanup) > 3600) {
  $db->cleanupExpiredData();
  apcu_store('last_cleanup', time());
}

// Route requests
$resource = $segments[0] ?? '';
$action = $segments[1] ?? '';

switch ($resource) {
  case 'auth':
    $_GET['action'] = $action;
    require 'auth.php';
    break;

  case 'projects':
    $_GET['action'] = $action;
    require 'projects.php';
    break;

  case 'personas':
    $_GET['action'] = $action;
    require 'personas.php';
    break;

  case 'simulations':
    $_GET['action'] = $action;
    require 'simulations.php';
    break;

  case 'reports':
    $_GET['action'] = $action;
    require 'reports.php';
    break;

  default:
    http_response_code(404);
    echo json_encode(['error' => 'Endpoint not found']);
    break;
}
