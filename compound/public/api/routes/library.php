<?php
/** Library listing + single book detail. */

function route_library($method, $seg) {
  require_user();
  $cat = $_GET['category'] ?? null;
  if ($cat && $cat !== 'All') {
    $s = db()->prepare('SELECT id, slug, title, author, category, cover_class, blurb, minutes FROM books WHERE category = ? AND is_hidden = 0 AND gen_status <> \'failed\' ORDER BY sort, id');
    $s->execute([$cat]);
    $books = $s->fetchAll();
  } else {
    $books = db()->query('SELECT id, slug, title, author, category, cover_class, blurb, minutes FROM books WHERE is_hidden = 0 AND gen_status <> \'failed\' ORDER BY sort, id')->fetchAll();
  }
  $cats = db()->query('SELECT DISTINCT category FROM books WHERE is_hidden = 0 ORDER BY category')->fetchAll(PDO::FETCH_COLUMN);
  require_once __DIR__ . '/plan.php';
  $u = current_user_opt();
  json_out(['books' => $books, 'categories' => array_merge(['All'], $cats), 'mine' => user_plan_books($u['id'])]);
}

function route_books($method, $seg) {
  $user = require_user();
  $id = (int)($seg[0] ?? 0);
  if (!$id) fail('not_found', 404);
  $b = db()->prepare('SELECT * FROM books WHERE id = ?');
  $b->execute([$id]);
  $book = $b->fetch();
  if (!$book || $book['is_hidden']) fail('not_found', 404);
  unset($book['needs_review'], $book['is_hidden']);
  $r = db()->prepare('SELECT reason, rank_no FROM user_books WHERE user_id = ? AND book_id = ?');
  $r->execute([$user['id'], $id]);
  $mine = $r->fetch();
  $book['reason'] = $mine['reason'] ?? null;
  $book['rank_no'] = isset($mine['rank_no']) ? (int)$mine['rank_no'] : null;
  $book['summary_ready'] = trim((string)$book['summary']) !== '';
  $ins = db()->prepare('SELECT idx, text FROM book_insights WHERE book_id = ? ORDER BY idx, id');
  $ins->execute([$id]);
  $book['insights'] = $ins->fetchAll();
  $cnt = db()->prepare('SELECT COUNT(*) FROM book_insights WHERE book_id = ?');
  $cnt->execute([$id]);
  $book['insight_count'] = (int)$cnt->fetchColumn();
  json_out(['book' => $book]);
}
