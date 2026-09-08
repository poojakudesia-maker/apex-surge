<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/anthropic.php';

$uid = require_user();
$pdo = db();
$action = $_GET['action'] ?? '';

if ($action === 'reply') {
    $in = json_input();
    $threadId = $in['threadId'] ?? null;
    $message = trim((string) ($in['message'] ?? ''));
    if ($message === '') json_error('message is required.');

    if (!$threadId) {
        $pdo->prepare('INSERT INTO coach_threads (user_id) VALUES (?)')->execute([$uid]);
        $threadId = (int) $pdo->lastInsertId();
    } else {
        $threadId = (int) $threadId;
        $check = $pdo->prepare('SELECT id FROM coach_threads WHERE id = ? AND user_id = ?');
        $check->execute([$threadId, $uid]);
        if (!$check->fetch()) json_error('Thread not found.', 404);
    }

    $insights = $pdo->prepare('SELECT text FROM playbook_insights WHERE user_id = ? ORDER BY created_at DESC LIMIT 6');
    $insights->execute([$uid]);
    $insightTexts = array_column($insights->fetchAll(), 'text');

    $journeys = $pdo->prepare("SELECT goal_title FROM journeys WHERE user_id = ? AND status = 'active' LIMIT 3");
    $journeys->execute([$uid]);
    $journeyTitles = array_column($journeys->fetchAll(), 'goal_title');

    $history = $pdo->prepare('SELECT role, text FROM coach_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 10');
    $history->execute([$threadId]);
    $historyRows = $history->fetchAll();

    $system = "You are the Apex Surge AI Coach. You are NOT a generic chatbot - you ground every
answer in what THIS user has already learned and is working on. Reference their active journeys and
past insights naturally where relevant, give concrete, actionable advice (not platitudes), and where
appropriate suggest a numbered \"before you act\" checklist. Keep replies under 180 words unless the
user asks for depth. If the situation is a conversation the user needs to have with someone, end by
offering to let them practice it via roleplay.

What we know about this user:
- Active journeys: " . ($journeyTitles ? implode(', ', $journeyTitles) : 'none yet') . "
- Things they've already learned about themselves:
- " . ($insightTexts ? implode("\n- ", $insightTexts) : '(nothing recorded yet)');

    $convo = array_map(fn($m) => ['role' => $m['role'] === 'user' ? 'user' : 'assistant', 'content' => $m['text']], $historyRows);
    $convo[] = ['role' => 'user', 'content' => $message];

    $reply = ask_claude_conversation($system, $convo, 'medium', 700);

    $pdo->prepare('INSERT INTO coach_messages (thread_id, role, text) VALUES (?, ?, ?)')->execute([$threadId, 'user', $message]);
    $pdo->prepare('INSERT INTO coach_messages (thread_id, role, text) VALUES (?, ?, ?)')->execute([$threadId, 'assistant', $reply]);

    json_out(['threadId' => $threadId, 'reply' => $reply]);
}

json_error('Unknown action.', 404);
