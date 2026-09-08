<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/anthropic.php';

$uid = require_user();
$pdo = db();
$action = $_GET['action'] ?? '';

if ($action === 'synthesize') {
    $in = json_input();
    $learnedTags = is_array($in['learnedTags'] ?? null) ? $in['learnedTags'] : [];
    $applied = (string) ($in['applied'] ?? '');
    $failedReason = (string) ($in['failedReason'] ?? '');

    $exp = $pdo->prepare("SELECT title, days FROM experiments WHERE user_id = ? AND status = 'active'");
    $exp->execute([$uid]);
    $experimentSummaries = array_map(function ($e) {
        $days = json_decode($e['days'], true) ?: [];
        $done = count(array_filter($days));
        return "\"{$e['title']}\": $done/" . count($days) . ' days done';
    }, $exp->fetchAll());

    $system = "You are Apex Surge's Adaptation Engine. Given a week of reflection, identify ONE
concrete behavioral pattern (not a platitude - reference specifics like time of day, context, or
triggers if the data suggests them) and propose one specific adjustment for next week's plan.";
    $userMsg = "This week: learned about " . ($learnedTags ? implode(', ', $learnedTags) : 'various topics') . ".
Applied: \"" . ($applied ?: 'not specified') . "\". What didn't work and why: \"" . ($failedReason ?: 'not specified') . "\".
Active experiments and completion so far: " . ($experimentSummaries ? implode('; ', $experimentSummaries) : 'none') . ".

Respond with JSON exactly:
{ \"pattern\": \"2 sentences, a specific observed behavioral pattern\", \"nextWeekPlan\": \"2 sentences, one specific adjustment for next week\" }";

    $result = ask_claude_json($system, $userMsg, 'medium');

    $pdo->prepare('INSERT INTO weekly_reviews (user_id, learned_tags, applied, failed_reason, pattern, next_week_plan) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$uid, json_encode($learnedTags), $applied, $failedReason, $result['pattern'], $result['nextWeekPlan']]);

    $scoreRow = $pdo->prepare('SELECT growth_score FROM users WHERE id = ?');
    $scoreRow->execute([$uid]);
    $newScore = clamp_score((int) $scoreRow->fetch()['growth_score'] + 2);
    $pdo->prepare('UPDATE users SET growth_score = ? WHERE id = ?')->execute([$newScore, $uid]);

    json_out(array_merge($result, ['growthScore' => $newScore]));
}

json_error('Unknown action.', 404);
