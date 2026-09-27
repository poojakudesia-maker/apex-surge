<?php
/** Field assignments: submit with photo/audio proof, fetch state, serve files. */

function route_assignments($method, $seg) {
  $user = require_user();
  $lid = (int)($seg[0] ?? 0);
  if (!$lid) fail('not_found', 404);

  // GET assignments/{lessonId}
  if ($method === 'GET' && count($seg) === 1) {
    json_out(['assignment' => user_assignment_state($user['id'], $lid)]);
  }

  // POST assignments/{lessonId}/submit  (multipart: reflection + files[])
  if ($method === 'POST' && ($seg[1] ?? '') === 'submit') {
    return assignment_submit($user['id'], $lid);
  }

  // POST assignments/{lessonId}/remind  (defer, keep pending, set due date)
  if ($method === 'POST' && ($seg[1] ?? '') === 'remind') {
    $tpl = assignment_template($lid);
    $due = date('Y-m-d H:i:s', strtotime('+' . ($tpl['due_days'] ?? 2) . ' days'));
    db()->prepare(
      'INSERT INTO user_assignment (user_id, lesson_id, status, due_at) VALUES (?,?,\'pending\',?)
       ON DUPLICATE KEY UPDATE due_at = VALUES(due_at)'
    )->execute([$user['id'], $lid, $due]);
    json_out(['ok' => true, 'assignment' => user_assignment_state($user['id'], $lid)]);
  }

  fail('not_found', 404);
}

/** Serve an uploaded file to its owner (or an admin). GET uploads/{fileId} */
function route_uploads($method, $seg) {
  $user = require_user();
  $fid = (int)($seg[0] ?? 0);
  if (!$fid) fail('not_found', 404);
  $s = db()->prepare(
    'SELECT af.*, ua.user_id FROM assignment_files af
     JOIN user_assignment ua ON ua.id = af.user_assignment_id WHERE af.id = ?');
  $s->execute([$fid]);
  $f = $s->fetch();
  if (!$f) fail('not_found', 404);
  $isAdmin = $user['is_admin'] || in_array(strtolower($user['email']), array_map('strtolower', cfg('admin_emails') ?: []), true);
  if ((int)$f['user_id'] !== (int)$user['id'] && !$isAdmin) fail('forbidden', 403);

  $abs = __DIR__ . '/../uploads/' . $f['path'];
  if (!is_file($abs)) fail('not_found', 404);
  $mime = mime_content_type($abs) ?: 'application/octet-stream';
  header('Content-Type: ' . $mime);
  header('Content-Length: ' . filesize($abs));
  header('Content-Disposition: inline; filename="' . basename($f['original_name'] ?: $f['path']) . '"');
  readfile($abs);
  exit;
}

// ---------- internals ----------

function assignment_template($lid) {
  $a = db()->prepare('SELECT * FROM assignments WHERE lesson_id = ?');
  $a->execute([$lid]);
  return $a->fetch() ?: ['title' => 'Field assignment', 'instructions' => '', 'examples' => '', 'due_days' => 2];
}

function user_assignment_state($uid, $lid) {
  $tpl = assignment_template($lid);
  $s = db()->prepare('SELECT * FROM user_assignment WHERE user_id = ? AND lesson_id = ?');
  $s->execute([$uid, $lid]);
  $ua = $s->fetch();
  $files = [];
  if ($ua) {
    $f = db()->prepare('SELECT id, kind, original_name, size FROM assignment_files WHERE user_assignment_id = ? ORDER BY id');
    $f->execute([$ua['id']]);
    $files = array_map(fn($x) => [
      'id' => (int)$x['id'], 'kind' => $x['kind'], 'name' => $x['original_name'],
      'size' => (int)$x['size'], 'url' => 'uploads/' . (int)$x['id'],
    ], $f->fetchAll());
  }
  return [
    'template' => [
      'title' => $tpl['title'], 'instructions' => $tpl['instructions'],
      'examples' => $tpl['examples'], 'due_days' => (int)$tpl['due_days'],
    ],
    'status'       => $ua['status'] ?? 'not_started',
    'reflection'   => $ua['reflection'] ?? '',
    'due_at'       => $ua['due_at'] ?? null,
    'submitted_at' => $ua['submitted_at'] ?? null,
    'feedback'     => $ua['feedback'] ?? null,
    'files'        => $files,
  ];
}

function assignment_submit($uid, $lid) {
  $tpl = assignment_template($lid);
  $reflection = substr(trim($_POST['reflection'] ?? ''), 0, 4000);
  $due = date('Y-m-d H:i:s', strtotime('+' . ($tpl['due_days'] ?? 2) . ' days'));

  db()->prepare(
    'INSERT INTO user_assignment (user_id, lesson_id, status, reflection, due_at, submitted_at)
     VALUES (?,?,\'submitted\',?,?,NOW())
     ON DUPLICATE KEY UPDATE status=\'submitted\', reflection=VALUES(reflection),
       due_at=IFNULL(due_at, VALUES(due_at)), submitted_at=NOW()'
  )->execute([$uid, $lid, $reflection, $due]);

  $ua = db()->prepare('SELECT id FROM user_assignment WHERE user_id=? AND lesson_id=?');
  $ua->execute([$uid, $lid]);
  $uaId = (int)$ua->fetchColumn();

  $saved = [];
  if (!empty($_FILES['files'])) {
    $maxBytes = (int)cfg('upload_max_mb') * 1024 * 1024;
    $dir = __DIR__ . '/../uploads/' . $uid;
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $allowed = [
      'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic',
      'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/webm' => 'webm', 'audio/ogg' => 'ogg',
      'audio/wav' => 'wav', 'audio/x-m4a' => 'm4a', 'video/webm' => 'webm',
    ];
    $names = (array)$_FILES['files']['name'];
    foreach ($names as $i => $origName) {
      if (($_FILES['files']['error'][$i] ?? 1) !== UPLOAD_ERR_OK) continue;
      $tmp = $_FILES['files']['tmp_name'][$i];
      $size = (int)$_FILES['files']['size'][$i];
      if ($size <= 0 || $size > $maxBytes) continue;
      $mime = mime_content_type($tmp) ?: '';
      if (!isset($allowed[$mime])) continue;
      $ext = $allowed[$mime];
      $kind = strpos($mime, 'image/') === 0 ? 'photo' : 'audio';
      $fname = $uid . '/' . bin2hex(random_bytes(8)) . '.' . $ext;
      $abs = __DIR__ . '/../uploads/' . $fname;
      if (!move_uploaded_file($tmp, $abs)) continue;
      db()->prepare(
        'INSERT INTO assignment_files (user_assignment_id, kind, path, original_name, size) VALUES (?,?,?,?,?)'
      )->execute([$uaId, $kind, $fname, substr($origName, 0, 200), $size]);
      $saved[] = ['id' => (int)db()->lastInsertId(), 'kind' => $kind];
    }
  }

  touch_streak($uid, 10, 0, 1); // +10 growth, +1 action done
  json_out(['ok' => true, 'files_saved' => count($saved), 'assignment' => user_assignment_state($uid, $lid)]);
}
