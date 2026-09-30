<?php
/**
 * Projects API Endpoints
 * POST   /api/projects         - Create project
 * GET    /api/projects         - List user's projects
 * GET    /api/projects/{id}    - Get project details
 * DELETE /api/projects/{id}    - Delete project
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../db/Database.php';

$db = Database::getInstance();
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

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

  return $db->fetchOne('SELECT id, email FROM users WHERE id = ?', [$session['user_id']]);
}

// ============ Create Project ============
if ($action === 'create' && $method === 'POST') {
  $user = getCurrentUser();
  if (!$user) {
    sendJson(['error' => 'Unauthorized'], 401);
  }

  $input = getJsonInput();
  $name = trim($input['name'] ?? '');
  $problemStatement = $input['problem_statement'] ?? '';
  $workflowType = $input['workflow_type'] ?? 'text'; // 'upload' or 'text'
  $workflowData = json_encode($input['workflow_data'] ?? []);

  if (!$name) {
    sendJson(['error' => 'Project name required'], 400);
  }

  $expiresAt = date('Y-m-d H:i:s', time() + DATA_TTL);

  try {
    $projectId = $db->insert('projects', [
      'user_id' => $user['id'],
      'name' => $name,
      'problem_statement' => $problemStatement,
      'workflow_type' => $workflowType,
      'workflow_data' => $workflowData,
      'expires_at' => $expiresAt
    ]);

    sendJson([
      'id' => $projectId,
      'name' => $name,
      'created_at' => date('Y-m-d H:i:s')
    ], 201);
  } catch (Exception $e) {
    sendJson(['error' => 'Failed to create project'], 500);
  }
}

// ============ List Projects ============
if ($action === 'list' && $method === 'GET') {
  $user = getCurrentUser();
  if (!$user) {
    sendJson(['error' => 'Unauthorized'], 401);
  }

  $projects = $db->fetchAll(
    'SELECT id, name, problem_statement, workflow_type, created_at, expires_at
     FROM projects
     WHERE user_id = ? AND expires_at > ?
     ORDER BY created_at DESC',
    [$user['id'], date('Y-m-d H:i:s')]
  );

  sendJson(['projects' => $projects], 200);
}

// ============ Get Project ============
if ($action === 'get' && $method === 'GET') {
  $user = getCurrentUser();
  if (!$user) {
    sendJson(['error' => 'Unauthorized'], 401);
  }

  $projectId = $_GET['id'] ?? null;
  if (!$projectId) {
    sendJson(['error' => 'Project ID required'], 400);
  }

  $project = $db->fetchOne(
    'SELECT * FROM projects WHERE id = ? AND user_id = ? AND expires_at > ?',
    [$projectId, $user['id'], date('Y-m-d H:i:s')]
  );

  if (!$project) {
    sendJson(['error' => 'Project not found'], 404);
  }

  $project['workflow_data'] = json_decode($project['workflow_data'], true);
  sendJson($project, 200);
}

// ============ Delete Project ============
if ($action === 'delete' && $method === 'DELETE') {
  $user = getCurrentUser();
  if (!$user) {
    sendJson(['error' => 'Unauthorized'], 401);
  }

  $projectId = $_GET['id'] ?? null;
  if (!$projectId) {
    sendJson(['error' => 'Project ID required'], 400);
  }

  // Verify ownership
  $project = $db->fetchOne(
    'SELECT id FROM projects WHERE id = ? AND user_id = ?',
    [$projectId, $user['id']]
  );

  if (!$project) {
    sendJson(['error' => 'Project not found'], 404);
  }

  // Delete cascade (personas, simulations, reports)
  $db->delete('simulations', 'project_id = ?', [$projectId]);
  $db->delete('personas', 'project_id = ?', [$projectId]);
  $db->delete('reports', 'project_id = ?', [$projectId]);
  $db->delete('projects', 'id = ?', [$projectId]);

  sendJson(['message' => 'Project deleted'], 200);
}

sendJson(['error' => 'Invalid endpoint'], 404);
