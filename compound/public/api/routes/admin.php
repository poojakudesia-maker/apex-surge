<?php
/** Admin CRUD for content + submission review. All endpoints require admin. */

function route_admin($method, $seg) {
  require_admin();
  $res = $seg[0] ?? '';
  $id  = isset($seg[1]) && ctype_digit($seg[1]) ? (int)$seg[1] : null;
  $sub = $seg[1] ?? ($seg[2] ?? '');

  switch ($res) {
    case 'overview':   return admin_overview();
    case 'paths':      return admin_crud('paths', $method, $id,
                          ['slug','title','subtitle','goal','description']);
    case 'books':      return admin_books($method, $id, $seg);
    case 'lessons':    return admin_crud('lessons', $method, $id,
                          ['path_id','idx','title','source_book_id','est_minutes','mission_line'], 'path_id');
    case 'cards':      return admin_crud('cards', $method, $id,
                          ['lesson_id','idx','heading','body','quote','callout_title','callout_body','source_label'], 'lesson_id');
    case 'questions':  return admin_questions($method, $id, $seg);
    case 'options':    return admin_crud('quiz_options', $method, $id,
                          ['question_id','idx','label','is_correct'], 'question_id');
    case 'assignment': return admin_assignment($method);
    case 'submissions':return admin_submissions($method, $id, $seg);
  }
  fail('not_found', 404);
}

function admin_overview() {
  $one = fn($sql) => (int)db()->query($sql)->fetchColumn();
  json_out(['counts' => [
    'users'       => $one('SELECT COUNT(*) FROM users'),
    'paths'       => $one('SELECT COUNT(*) FROM paths'),
    'lessons'     => $one('SELECT COUNT(*) FROM lessons'),
    'books'       => $one('SELECT COUNT(*) FROM books'),
    'cards'       => $one('SELECT COUNT(*) FROM cards'),
    'questions'   => $one('SELECT COUNT(*) FROM quiz_questions'),
    'submissions' => $one("SELECT COUNT(*) FROM user_assignment WHERE status='submitted'"),
  ]]);
}

/** Generic list/upsert/delete for a table with a whitelist of columns. */
function admin_crud($table, $method, $id, $cols, $filterCol = null) {
  if ($method === 'GET') {
    if ($filterCol && isset($_GET[$filterCol])) {
      $st = db()->prepare("SELECT * FROM `$table` WHERE `$filterCol` = ? ORDER BY id");
      $st->execute([(int)$_GET[$filterCol]]);
      json_out(['rows' => $st->fetchAll()]);
    }
    json_out(['rows' => db()->query("SELECT * FROM `$table` ORDER BY id")->fetchAll()]);
  }
  if ($method === 'POST') {
    $b = body_json();
    $data = [];
    foreach ($cols as $c) if (array_key_exists($c, $b)) $data[$c] = $b[$c] === '' ? null : $b[$c];
    if (!empty($b['id'])) {
      $sets = implode(', ', array_map(fn($c) => "`$c` = :$c", array_keys($data)));
      $data['id'] = (int)$b['id'];
      db()->prepare("UPDATE `$table` SET $sets WHERE id = :id")->execute($data);
      json_out(['ok' => true, 'id' => (int)$b['id']]);
    } else {
      $keys = array_keys($data);
      $ph = implode(', ', array_map(fn($c) => ":$c", $keys));
      db()->prepare("INSERT INTO `$table` (`" . implode('`,`', $keys) . "`) VALUES ($ph)")->execute($data);
      json_out(['ok' => true, 'id' => (int)db()->lastInsertId()]);
    }
  }
  if ($method === 'DELETE' && $id) {
    db()->prepare("DELETE FROM `$table` WHERE id = ?")->execute([$id]);
    json_out(['ok' => true]);
  }
  fail('method_not_allowed', 405);
}

function admin_books($method, $id, $seg) {
  // GET books/{id}/insights or POST/DELETE insights handled inline
  if (($seg[2] ?? '') === 'insights') {
    if ($method === 'GET') {
      $s = db()->prepare('SELECT * FROM book_insights WHERE book_id = ? ORDER BY idx, id');
      $s->execute([$id]); json_out(['rows' => $s->fetchAll()]);
    }
    if ($method === 'POST') {
      $b = body_json();
      db()->prepare('INSERT INTO book_insights (book_id, idx, text) VALUES (?,?,?)')
          ->execute([$id, (int)($b['idx'] ?? 0), substr($b['text'] ?? '', 0, 400)]);
      json_out(['ok' => true, 'id' => (int)db()->lastInsertId()]);
    }
  }
  return admin_crud('books', $method, $id, ['slug','title','author','category','cover_class','blurb','minutes','sort']);
}

function admin_questions($method, $id, $seg) {
  // GET questions?lesson_id -> questions with nested options
  if ($method === 'GET' && isset($_GET['lesson_id'])) {
    $q = db()->prepare('SELECT * FROM quiz_questions WHERE lesson_id = ? ORDER BY idx, id');
    $q->execute([(int)$_GET['lesson_id']]);
    $rows = $q->fetchAll();
    $opt = db()->prepare('SELECT * FROM quiz_options WHERE question_id = ? ORDER BY idx, id');
    foreach ($rows as &$r) { $opt->execute([$r['id']]); $r['options'] = $opt->fetchAll(); }
    json_out(['rows' => $rows]);
  }
  return admin_crud('quiz_questions', $method, $id, ['lesson_id','idx','question','explanation'], 'lesson_id');
}

function admin_assignment($method) {
  if ($method === 'GET' && isset($_GET['lesson_id'])) {
    $s = db()->prepare('SELECT * FROM assignments WHERE lesson_id = ?');
    $s->execute([(int)$_GET['lesson_id']]);
    json_out(['assignment' => $s->fetch() ?: null]);
  }
  if ($method === 'POST') {
    $b = body_json();
    $lid = (int)($b['lesson_id'] ?? 0);
    db()->prepare(
      'INSERT INTO assignments (lesson_id, title, instructions, examples, due_days) VALUES (?,?,?,?,?)
       ON DUPLICATE KEY UPDATE title=VALUES(title), instructions=VALUES(instructions),
         examples=VALUES(examples), due_days=VALUES(due_days)'
    )->execute([$lid, $b['title'] ?? 'Field assignment', $b['instructions'] ?? '', $b['examples'] ?? '', (int)($b['due_days'] ?? 2)]);
    json_out(['ok' => true]);
  }
  fail('method_not_allowed', 405);
}

function admin_submissions($method, $id, $seg) {
  if ($method === 'GET' && !$id) {
    $s = db()->query(
      "SELECT ua.id, ua.status, ua.reflection, ua.submitted_at, ua.feedback,
              u.email, l.title AS lesson_title
       FROM user_assignment ua
       JOIN users u ON u.id = ua.user_id
       JOIN lessons l ON l.id = ua.lesson_id
       WHERE ua.status IN ('submitted','reviewed')
       ORDER BY ua.submitted_at DESC LIMIT 100");
    json_out(['rows' => $s->fetchAll()]);
  }
  if ($method === 'GET' && $id) {
    $s = db()->prepare(
      'SELECT ua.*, u.email, l.title AS lesson_title FROM user_assignment ua
       JOIN users u ON u.id = ua.user_id JOIN lessons l ON l.id = ua.lesson_id WHERE ua.id = ?');
    $s->execute([$id]);
    $row = $s->fetch();
    if (!$row) fail('not_found', 404);
    $f = db()->prepare('SELECT id, kind, original_name FROM assignment_files WHERE user_assignment_id = ?');
    $f->execute([$id]);
    $row['files'] = array_map(fn($x) => ['id'=>(int)$x['id'],'kind'=>$x['kind'],'name'=>$x['original_name'],'url'=>'uploads/'.(int)$x['id']], $f->fetchAll());
    json_out(['submission' => $row]);
  }
  if ($method === 'POST' && $id && ($seg[2] ?? '') === 'review') {
    $b = body_json();
    db()->prepare("UPDATE user_assignment SET status='reviewed', feedback=?, reviewed_at=NOW() WHERE id=?")
        ->execute([substr($b['feedback'] ?? '', 0, 2000), $id]);
    json_out(['ok' => true]);
  }
  fail('not_found', 404);
}
