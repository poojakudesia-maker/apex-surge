<?php
/** Library listing + single book detail. */

function route_library($method, $seg) {
  require_user();
  $cat = $_GET['category'] ?? null;
  if ($cat && $cat !== 'All') {
    $s = db()->prepare('SELECT id, slug, title, author, category, cover_class, blurb, minutes FROM books WHERE category = ? ORDER BY sort, id');
    $s->execute([$cat]);
    $books = $s->fetchAll();
  } else {
    $books = db()->query('SELECT id, slug, title, author, category, cover_class, blurb, minutes FROM books ORDER BY sort, id')->fetchAll();
  }
  $cats = db()->query('SELECT DISTINCT category FROM books ORDER BY category')->fetchAll(PDO::FETCH_COLUMN);
  json_out(['books' => $books, 'categories' => array_merge(['All'], $cats)]);
}

function route_books($method, $seg) {
  require_user();
  $id = (int)($seg[0] ?? 0);
  if (!$id) fail('not_found', 404);
  $b = db()->prepare('SELECT * FROM books WHERE id = ?');
  $b->execute([$id]);
  $book = $b->fetch();
  if (!$book) fail('not_found', 404);
  $ins = db()->prepare('SELECT idx, text FROM book_insights WHERE book_id = ? ORDER BY idx, id');
  $ins->execute([$id]);
  $book['insights'] = $ins->fetchAll();
  $cnt = db()->prepare('SELECT COUNT(*) FROM book_insights WHERE book_id = ?');
  $cnt->execute([$id]);
  $book['insight_count'] = (int)$cnt->fetchColumn();
  json_out(['book' => $book]);
}
