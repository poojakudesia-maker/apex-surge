<?php
require_once __DIR__ . '/helpers.php';

$uid = require_user();
$pdo = db();
$action = $_GET['action'] ?? '';

if ($action === 'principles') {
    $stmt = $pdo->prepare('SELECT id, text FROM playbook_principles WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$uid]);
    json_out(['items' => $stmt->fetchAll()]);
}

if ($action === 'addPrinciple') {
    $in = json_input();
    $text = trim((string) ($in['text'] ?? ''));
    if ($text === '') json_error('text is required.');
    $pdo->prepare('INSERT INTO playbook_principles (user_id, text) VALUES (?, ?)')->execute([$uid, $text]);
    json_out(['ok' => true]);
}

if ($action === 'insights') {
    $stmt = $pdo->prepare('SELECT id, book, text FROM playbook_insights WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$uid]);
    json_out(['items' => $stmt->fetchAll()]);
}

if ($action === 'works') {
    $stmt = $pdo->prepare('SELECT id, text FROM works_for_me WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$uid]);
    json_out(['items' => $stmt->fetchAll()]);
}

if ($action === 'addWorks') {
    $in = json_input();
    $text = trim((string) ($in['text'] ?? ''));
    if ($text === '') json_error('text is required.');
    $pdo->prepare('INSERT INTO works_for_me (user_id, text) VALUES (?, ?)')->execute([$uid, $text]);
    json_out(['ok' => true]);
}

if ($action === 'experiments') {
    $stmt = $pdo->prepare('SELECT * FROM experiments WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$uid]);
    $items = array_map(function ($e) {
        return [
            'id' => (int) $e['id'], 'title' => $e['title'], 'description' => $e['description'],
            'area' => $e['area'], 'behavior' => $e['behavior'], 'source' => $e['source'],
            'days' => json_decode($e['days'] ?? '[]', true) ?: [], 'status' => $e['status'], 'streak' => (int) $e['streak'],
        ];
    }, $stmt->fetchAll());
    json_out(['items' => $items]);
}

if ($action === 'toggleExperimentDay') {
    $in = json_input();
    $experimentId = (int) ($in['experimentId'] ?? 0);
    $dayIndex = (int) ($in['dayIndex'] ?? 0);

    $stmt = $pdo->prepare('SELECT * FROM experiments WHERE id = ? AND user_id = ?');
    $stmt->execute([$experimentId, $uid]);
    $row = $stmt->fetch();
    if (!$row) json_error('Experiment not found.', 404);

    $days = json_decode($row['days'] ?? '[]', true) ?: [];
    $days[$dayIndex] = empty($days[$dayIndex]);
    $pdo->prepare('UPDATE experiments SET days = ? WHERE id = ?')->execute([json_encode($days), $experimentId]);
    json_out(['days' => $days]);
}

json_error('Unknown action.', 404);
