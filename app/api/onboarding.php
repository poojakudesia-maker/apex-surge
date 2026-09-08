<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/anthropic.php';

$uid = require_user();
$in = json_input();

$why = (string) ($in['why'] ?? '');
$areas = is_array($in['areas'] ?? null) ? $in['areas'] : [];
$challenge = (string) ($in['challenge'] ?? '');
$time = (int) ($in['time'] ?? 10);
$style = (string) ($in['style'] ?? 'interactive');

$system = "You are the content engine for Apex Surge, an app that turns ideas from
the world's best non-fiction books into personalized real-world experiments for the user's
actual life. You never recommend \"read another book\" as an end in itself - every idea becomes
a small, concrete action. Ground every lesson in a real, well-known non-fiction book and author
(behavioral science, habits, productivity, leadership, communication, confidence - whatever fits
the user's stated challenge). Keep language warm, direct, and free of fluff.";

$areasText = $areas ? implode(', ', $areas) : 'not specified';
$userMsg = "A new user just finished onboarding. Here is what they told us:
- Why they want to grow: \"$why\"
- Life areas they chose to focus on: $areasText
- Their biggest current challenge: \"$challenge\"
- Daily time they can give: $time minutes
- Preferred learning style: $style

Produce a JSON object with this exact shape:
{
  \"summary\": \"2-3 sentence warm, specific summary of what their Growth Profile is about, referencing their actual challenge\",
  \"journeyTitle\": \"a short 3-6 word title for their first 7-day journey, specific to their challenge\",
  \"firstMission\": {
    \"bookTitle\": \"a real, well-known non-fiction book title relevant to their challenge\",
    \"bookAuthor\": \"that book's real author\",
    \"lessonTitle\": \"a punchy 6-10 word lesson title\",
    \"lessonBody\": [\"paragraph 1 (2-3 sentences)\", \"paragraph 2 (2-3 sentences)\", \"paragraph 3 (2-3 sentences)\"],
    \"quizQuestion\": \"one comprehension question about the lesson's core idea\",
    \"quizOptions\": [\"option A\", \"option B\", \"option C\"],
    \"quizCorrectIndex\": 0,
    \"quizExplain\": \"one sentence explaining why the correct answer is correct\"
  }
}
The lesson must take about $time minutes to read and connect directly to their stated challenge.";

$result = ask_claude_json($system, $userMsg, 'high');
$fm = $result['firstMission'];

$pdo = db();
$pdo->prepare('UPDATE users SET onboarding_why=?, onboarding_areas=?, onboarding_challenge=?, onboarding_time=?, onboarding_style=?, onboarding_complete=1, journey_title=?, growth_score=50, streak=0 WHERE id=?')
    ->execute([$why, json_encode($areas), $challenge, $time, $style, $result['journeyTitle'], $uid]);

$stmt = $pdo->prepare('INSERT INTO missions
    (user_id, mission_date, status, book_title, book_author, lesson_title, lesson_body, quiz_question, quiz_options, quiz_correct_index, quiz_explain, duration_min)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE book_title=VALUES(book_title)');
$stmt->execute([
    $uid, today_str(), 'pending', $fm['bookTitle'], $fm['bookAuthor'], $fm['lessonTitle'],
    json_encode($fm['lessonBody']), $fm['quizQuestion'], json_encode($fm['quizOptions']),
    $fm['quizCorrectIndex'], $fm['quizExplain'], $time,
]);

json_out(array_merge($result, ['missionId' => today_str()]));
