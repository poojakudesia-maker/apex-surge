<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/anthropic.php';

$uid = require_user();
$pdo = db();
$action = $_GET['action'] ?? '';

$PERSONAS = [
    'manager' => "You are playing the role of the user's direct manager in a roleplay practice session.
Be realistic: professional, a little busy, not hostile but not a pushover - push back mildly and ask
follow-up questions before conceding anything. Stay fully in character, 2-4 sentences per reply.",
    'report' => "You are playing the role of the user's direct report receiving feedback in a roleplay
practice session. React like a real person would: a little defensive at first, then open up if the
user is clear and kind. Stay fully in character, 2-4 sentences per reply.",
    'client' => "You are playing the role of a difficult client in a roleplay practice session. Push for
more than is reasonable, but respond like a real person to a well-held boundary. Stay fully in
character, 2-4 sentences per reply.",
];

if ($action === 'reply') {
    $in = json_input();
    $roleplayId = $in['roleplayId'] ?? null;
    $scenario = (string) ($in['scenario'] ?? 'manager');
    $message = trim((string) ($in['message'] ?? ''));
    if ($message === '') json_error('message is required.');
    $persona = $PERSONAS[$scenario] ?? $PERSONAS['manager'];

    $transcript = [];
    if ($roleplayId) {
        $stmt = $pdo->prepare('SELECT * FROM roleplays WHERE id = ? AND user_id = ?');
        $stmt->execute([(int) $roleplayId, $uid]);
        $row = $stmt->fetch();
        if (!$row) json_error('Roleplay not found.', 404);
        $transcript = json_decode($row['transcript'], true) ?: [];
    } else {
        $pdo->prepare('INSERT INTO roleplays (user_id, scenario, transcript) VALUES (?, ?, ?)')->execute([$uid, $scenario, '[]']);
        $roleplayId = (int) $pdo->lastInsertId();
    }

    $transcript[] = ['role' => 'user', 'text' => $message];
    $history = array_map(fn($t) => ['role' => $t['role'], 'content' => $t['text']], $transcript);
    $reply = ask_claude_conversation($persona, $history, 'medium', 300);
    $transcript[] = ['role' => 'assistant', 'text' => $reply];

    $pdo->prepare('UPDATE roleplays SET transcript = ? WHERE id = ?')->execute([json_encode($transcript), $roleplayId]);
    json_out(['roleplayId' => $roleplayId, 'reply' => $reply]);
}

if ($action === 'feedback') {
    $in = json_input();
    $roleplayId = (int) ($in['roleplayId'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM roleplays WHERE id = ? AND user_id = ?');
    $stmt->execute([$roleplayId, $uid]);
    $row = $stmt->fetch();
    if (!$row) json_error('Roleplay not found.', 404);
    $transcript = json_decode($row['transcript'], true) ?: [];

    $system = "You are a communication coach scoring a practice roleplay conversation. Score the
USER's turns only (not the AI persona's) on a 1-10 scale for each dimension. Be honest but
encouraging, and the \"note\" should name ONE specific, actionable thing to improve.";
    $transcriptText = implode("\n", array_map(fn($t) => ($t['role'] === 'user' ? 'User' : 'Other person') . ': ' . $t['text'], $transcript));
    $userMsg = "Transcript:\n$transcriptText\n\nRespond with JSON exactly:
{ \"clarity\": 8, \"confidence\": 6, \"evidence\": 9, \"assertiveness\": 5, \"note\": \"one sentence, specific and actionable\" }";

    $feedback = ask_claude_json($system, $userMsg, 'medium');
    $pdo->prepare('UPDATE roleplays SET feedback = ? WHERE id = ?')->execute([json_encode($feedback), $roleplayId]);
    json_out($feedback);
}

json_error('Unknown action.', 404);
