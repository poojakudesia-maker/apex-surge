<?php
/** Front controller. All /api/* requests land here (see /.htaccess). */
require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/claude.php';

send_cors();

// Resolve route: .htaccess rewrites /api/foo/bar -> index.php?route=foo/bar
$route = $_GET['route'] ?? ($_SERVER['PATH_INFO'] ?? '');
$route = trim($route, '/');
$segments = $route === '' ? [] : explode('/', $route);
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$head = $segments[0] ?? '';

$map = [
  'auth'        => 'auth.php',
  'onboarding'  => 'onboarding.php',
  'home'        => 'progress.php',
  'progress'    => 'progress.php',
  'stats'       => 'progress.php',
  'playbook'    => 'progress.php',
  'paths'       => 'paths.php',
  'lessons'     => 'lessons.php',
  'quiz'        => 'quiz.php',
  'assignments' => 'assignments.php',
  'uploads'     => 'assignments.php',
  'library'     => 'library.php',
  'books'       => 'library.php',
  'coach'       => 'coach.php',
  'admin'       => 'admin.php',
];

if ($head === '' || $head === 'ping') {
  json_out(['ok' => true, 'service' => 'compound-api', 'time' => date('c')]);
}
if (!isset($map[$head])) fail('not_found', 404);

require __DIR__ . '/routes/' . $map[$head];
$fn = 'route_' . $head;
if (!function_exists($fn)) fail('not_found', 404);
$fn($method, array_slice($segments, 1));
