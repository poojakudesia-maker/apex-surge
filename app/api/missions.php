<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/anthropic.php';

$uid = require_user();
$pdo = db();
$action = $_GET['action'] ?? '';

function mission_out(array $row): array {
    return [
        'id' => $row['mission_date'],
        'date' => $row['mission_date'],
        'status' => $row['status'],
        'bookTitle' => $row['book_title'],
        'bookAuthor' => $row['book_author'],
        'lessonTitle' => $row['lesson_title'],
        'lessonBody' => json_decode($row['lesson_body'] ?? '[]', true) ?: [],
        'quizQuestion' => $row['quiz_question'],
        'quizOptions' => json_decode($row['quiz_options'] ?? '[]', true) ?: [],
        'quizCorrectIndex' => (int) $row['quiz_correct_index'],
        'quizExplain' => $row['quiz_explain'],
        'quizAnswer' => $row['quiz_answer'] === null ? null : (int) $row['quiz_answer'],
        'reflection' => $row['reflection'],
        'pattern' => $row['pattern'] ? json_decode($row['pattern'], true) : null,
        'experiment' => $row['experiment'] ? json_decode($row['experiment'], true) : null,
        'durationMin' => (int) $row['duration_min'],
    ];
}

function fetch_mission(PDO $pdo, int $uid, string $date): ?array {
    $stmt = $pdo->prepare('SELECT * FROM missions WHERE user_id = ? AND mission_date = ?');
    $stmt->execute([$uid, $date]);
    $row = $stmt->fetch();
    return $row ?: null;
}

if ($action === 'today') {
    $row = fetch_mission($pdo, $uid, today_str());
    json_out(['mission' => $row ? mission_out($row) : null]);
}

if ($action === 'generateDaily') {
    $existing = fetch_mission($pdo, $uid, today_str());
    if ($existing) json_out(['mission' => mission_out($existing), 'alreadyExists' => true]);

    $userRow = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $userRow->execute([$uid]);
    $user = $userRow->fetch();
    if (!$user) json_error('User not found.', 404);

    $insights = $pdo->prepare('SELECT text FROM playbook_insights WHERE user_id = ? ORDER BY created_at DESC LIMIT 8');
    $insights->execute([$uid]);
    $insightTexts = array_column($insights->fetchAll(), 'text');

    $recent = $pdo->prepare('SELECT lesson_title FROM missions WHERE user_id = ? ORDER BY created_at DESC LIMIT 5');
    $recent->execute([$uid]);
    $recentTitles = array_column($recent->fetchAll(), 'lesson_title');

    $journeys = $pdo->prepare("SELECT goal_title FROM journeys WHERE user_id = ? AND status = 'active' LIMIT 3");
    $journeys->execute([$uid]);
    $journeyTitles = array_column($journeys->fetchAll(), 'goal_title');

    $system = "You are the content engine for Apex Surge. You author one short, grounded
lesson per day, each based on a real, well-known non-fiction book, that builds on what the user
already knows and connects to their active journeys and challenge. Never repeat a lesson title
already used. Keep language warm, direct, and free of fluff.";

    $areas = json_decode($user['onboarding_areas'] ?? '[]', true) ?: [];
    $userMsg = "User's original challenge: \"" . ($user['onboarding_challenge'] ?: 'not specified') . "\"
Life areas: " . ($areas ? implode(', ', $areas) : 'not specified') . "
Daily time budget: " . ($user['onboarding_time'] ?: 10) . " minutes
Active journeys: " . ($journeyTitles ? implode(', ', $journeyTitles) : 'none') . "
Things already learned about this user: " . ($insightTexts ? implode('; ', $insightTexts) : 'nothing yet') . "
Lesson titles already used (do not repeat): " . ($recentTitles ? implode(', ', $recentTitles) : 'none') . "

Produce a JSON object with this exact shape:
{
  \"bookTitle\": \"a real, well-known non-fiction book title relevant to their challenge/journeys\",
  \"bookAuthor\": \"that book's real author\",
  \"lessonTitle\": \"a punchy 6-10 word lesson title, not reused\",
  \"lessonBody\": [\"paragraph 1 (2-3 sentences)\", \"paragraph 2 (2-3 sentences)\", \"paragraph 3 (2-3 sentences)\"],
  \"quizQuestion\": \"one comprehension question about the lesson's core idea\",
  \"quizOptions\": [\"option A\", \"option B\", \"option C\"],
  \"quizCorrectIndex\": 0,
  \"quizExplain\": \"one sentence explaining why the correct answer is correct\"
}
The lesson must take about " . ($user['onboarding_time'] ?: 10) . " minutes to read.";

    $fm = ask_claude_json($system, $userMsg, 'high');

    $stmt = $pdo->prepare('INSERT INTO missions
        (user_id, mission_date, status, book_title, book_author, lesson_title, lesson_body, quiz_question, quiz_options, quiz_correct_index, quiz_explain, duration_min)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $uid, today_str(), 'pending', $fm['bookTitle'], $fm['bookAuthor'], $fm['lessonTitle'],
        json_encode($fm['lessonBody']), $fm['quizQuestion'], json_encode($fm['quizOptions']),
        $fm['quizCorrectIndex'], $fm['quizExplain'], $user['onboarding_time'] ?: 10,
    ]);

    json_out(['mission' => mission_out(fetch_mission($pdo, $uid, today_str()))]);
}

if ($action === 'quizAnswer') {
    $in = json_input();
    $missionId = (string) ($in['missionId'] ?? today_str());
    $answer = (int) ($in['answer'] ?? -1);
    $pdo->prepare('UPDATE missions SET quiz_answer = ? WHERE user_id = ? AND mission_date = ?')
        ->execute([$answer, $uid, $missionId]);
    json_out(['ok' => true]);
}

if ($action === 'diagnose') {
    $in = json_input();
    $missionId = (string) ($in['missionId'] ?? today_str());
    $reflectionText = trim((string) ($in['reflectionText'] ?? ''));
    if ($reflectionText === '') json_error('reflectionText is required.');

    $mission = fetch_mission($pdo, $uid, $missionId);
    if (!$mission) json_error('Mission not found.', 404);

    $system = "You are Apex Surge's Application Engine. Given a lesson the user just learned
and their own words about a real struggle, you (1) name their behavior pattern in blunt, specific,
non-judgmental language, and (2) design ONE tiny, concretely scheduled real-world experiment that
applies the lesson to that exact struggle. Experiments must be small enough to be almost impossible
to refuse (a specific action, a specific trigger/time, under 15 minutes), and run 3-7 days.";

    $lessonBody = implode(' ', json_decode($mission['lesson_body'] ?? '[]', true) ?: []);
    $userMsg = "Today's lesson: \"{$mission['lesson_title']}\" from \"{$mission['book_title']}\" by {$mission['book_author']}.
Lesson content: $lessonBody

The user's reflection on what they're struggling with right now: \"$reflectionText\"

Respond with JSON exactly matching:
{
  \"pattern\": {
    \"trigger\": \"short phrase - what sets the behavior off\",
    \"behavior\": \"short phrase - what they actually do\",
    \"underlyingIssue\": \"short phrase - the real root cause\",
    \"relatedBooks\": [\"book title 1\", \"book title 2\", \"book title 3\"]
  },
  \"experiment\": {
    \"title\": \"one sentence, imperative, very concrete action tied to a specific time/trigger\",
    \"description\": \"1 sentence describing exactly what to do and when\",
    \"durationDays\": 3,
    \"timeOfDay\": \"e.g. 'Tomorrow at 9:30 AM' or 'Right after you brush your teeth tonight'\"
  }
}";

    $result = ask_claude_json($system, $userMsg, 'high');
    $days = array_fill(0, (int) $result['experiment']['durationDays'], false);
    $experiment = array_merge($result['experiment'], ['days' => $days, 'status' => 'active', 'adaptedStrategy' => null]);

    $pdo->prepare('UPDATE missions SET reflection=?, pattern=?, experiment=?, status=? WHERE user_id=? AND mission_date=?')
        ->execute([$reflectionText, json_encode($result['pattern']), json_encode($experiment), 'reflected', $uid, $missionId]);

    json_out($result);
}

if ($action === 'markDay') {
    $in = json_input();
    $missionId = (string) ($in['missionId'] ?? today_str());
    $dayIndex = (int) ($in['dayIndex'] ?? 0);
    $done = (bool) ($in['done'] ?? true);

    $mission = fetch_mission($pdo, $uid, $missionId);
    if (!$mission) json_error('Mission not found.', 404);
    $experiment = json_decode($mission['experiment'] ?? '{}', true) ?: [];
    $days = $experiment['days'] ?? [];
    $days[$dayIndex] = $done;
    $experiment['days'] = $days;

    $pdo->prepare('UPDATE missions SET experiment=? WHERE user_id=? AND mission_date=?')
        ->execute([json_encode($experiment), $uid, $missionId]);

    if ($done) {
        $pdo->prepare('UPDATE users SET growth_score = LEAST(100, growth_score + 1) WHERE id = ?')->execute([$uid]);
    }
    json_out(['days' => $days]);
}

if ($action === 'adapt') {
    $in = json_input();
    $missionId = (string) ($in['missionId'] ?? today_str());
    $missedReason = trim((string) ($in['missedReason'] ?? ''));

    $mission = fetch_mission($pdo, $uid, $missionId);
    if (!$mission) json_error('Mission not found.', 404);
    $experiment = json_decode($mission['experiment'] ?? '{}', true) ?: [];

    $system = "You are Apex Surge's Behavior Engine. The user ran a small experiment and missed
a day. Given why, identify the real cause in one sentence and propose one concrete adjustment to the
experiment (a new time, trigger, or format) that removes that specific obstacle. Be specific and brief.";
    $userMsg = "Experiment: \"{$experiment['title']}\". They missed a day because: \"$missedReason\".
Respond with plain text, max 2 sentences: first the diagnosis, then the adjusted strategy.";

    $adaptedStrategy = ask_claude_text($system, $userMsg, 'medium', 300);
    $experiment['adaptedStrategy'] = $adaptedStrategy;

    $pdo->prepare('UPDATE missions SET experiment=? WHERE user_id=? AND mission_date=?')
        ->execute([json_encode($experiment), $uid, $missionId]);
    json_out(['adaptedStrategy' => $adaptedStrategy]);
}

if ($action === 'complete') {
    $in = json_input();
    $missionId = (string) ($in['missionId'] ?? today_str());

    $mission = fetch_mission($pdo, $uid, $missionId);
    if (!$mission) json_error('Mission not found.', 404);
    $pdo->prepare("UPDATE missions SET status='complete' WHERE user_id=? AND mission_date=?")->execute([$uid, $missionId]);

    $userRow = $pdo->prepare('SELECT streak, growth_score, last_active_date FROM users WHERE id = ?');
    $userRow->execute([$uid]);
    $user = $userRow->fetch();

    $today = today_str();
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $lastActive = $user['last_active_date'];
    $newStreak = ($lastActive === $yesterday || $lastActive === $today) ? ((int) $user['streak'] + 1) : 1;
    $newScore = clamp_score((int) $user['growth_score'] + 3);

    $pdo->prepare('UPDATE users SET streak=?, growth_score=?, last_active_date=? WHERE id=?')
        ->execute([$newStreak, $newScore, $today, $uid]);

    $pattern = $mission['pattern'] ? json_decode($mission['pattern'], true) : null;
    if ($pattern) {
        $pdo->prepare('INSERT INTO playbook_insights (user_id, book, text) VALUES (?, ?, ?)')
            ->execute([$uid, $mission['book_title'], $pattern['underlyingIssue'] . " (from: \"{$mission['lesson_title']}\")"]);
    }

    json_out(['streak' => $newStreak, 'growthScore' => $newScore]);
}

json_error('Unknown action.', 404);
