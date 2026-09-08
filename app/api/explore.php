<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/anthropic.php';

$uid = require_user();
$pdo = db();
$action = $_GET['action'] ?? '';

if ($action === 'books') {
    $rows = $pdo->query('SELECT * FROM books')->fetchAll();
    $books = array_map(function ($b) {
        return [
            'id' => $b['id'], 'title' => $b['title'], 'author' => $b['author'],
            'tag' => $b['tag'], 'color' => $b['color'], 'keyIdea' => $b['key_idea'], 'example' => $b['example'],
        ];
    }, $rows);
    json_out(['books' => $books]);
}

if ($action === 'applyToLife') {
    $in = json_input();
    $bookTitle = (string) ($in['bookTitle'] ?? '');
    $bookAuthor = (string) ($in['bookAuthor'] ?? '');
    $keyIdea = (string) ($in['keyIdea'] ?? '');
    $area = (string) ($in['area'] ?? '');
    $behavior = trim((string) ($in['behavior'] ?? ''));
    if ($behavior === '') json_error('behavior is required.');

    $system = "You are Apex Surge's Application Engine. Turn a book's key idea into ONE tiny,
concretely scheduled real-world experiment (2-5 days) that targets the specific behavior the user
named, in the specific life area they chose. Be concrete: name exact times, triggers, or checkpoints.";
    $userMsg = "Book: \"$bookTitle\" by $bookAuthor. Key idea: \"$keyIdea\".
Life area: $area. Behavior the user wants to change: \"$behavior\".

Respond with JSON exactly:
{ \"title\": \"imperative one-sentence experiment tied to a concrete schedule\", \"description\": \"1 sentence, what to do and when\", \"durationDays\": 3 }";

    $plan = ask_claude_json($system, $userMsg, 'medium');
    $days = array_fill(0, (int) $plan['durationDays'], false);

    $stmt = $pdo->prepare('INSERT INTO experiments (user_id, title, description, area, behavior, source, days, status, streak) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)');
    $stmt->execute([$uid, $plan['title'], $plan['description'], $area, $behavior, $bookTitle, json_encode($days), 'active']);

    json_out(array_merge(['experimentId' => (int) $pdo->lastInsertId()], $plan));
}

json_error('Unknown action.', 404);
