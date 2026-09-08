<?php
require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/anthropic.php';

const MAX_ACTIVE_JOURNEYS = 3;

$uid = require_user();
$pdo = db();
$action = $_GET['action'] ?? '';

function journey_out(array $j): array {
    return [
        'id' => (int) $j['id'],
        'goalTitle' => $j['goal_title'],
        'goalDescription' => $j['goal_description'],
        'weeks' => json_decode($j['weeks'] ?? '[]', true) ?: [],
        'focusAreas' => json_decode($j['focus_areas'] ?? '[]', true) ?: [],
        'bookRefs' => json_decode($j['book_refs'] ?? '[]', true) ?: [],
        'assessment' => json_decode($j['assessment'] ?? '[]', true) ?: [],
        'currentWeek' => (int) $j['current_week'],
        'progressPct' => (int) $j['progress_pct'],
        'status' => $j['status'],
    ];
}

if ($action === 'list') {
    $stmt = $pdo->prepare('SELECT * FROM journeys WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$uid]);
    json_out(['journeys' => array_map('journey_out', $stmt->fetchAll())]);
}

if ($action === 'generateRoadmap') {
    $in = json_input();
    $goalTitle = trim((string) ($in['goalTitle'] ?? ''));
    $goalDescription = (string) ($in['goalDescription'] ?? '');
    $weeks = max(1, (int) ($in['weeks'] ?? 6));
    $assessment = is_array($in['assessment'] ?? null) ? $in['assessment'] : [];
    if ($goalTitle === '') json_error('goalTitle is required.');

    $activeCount = $pdo->prepare("SELECT COUNT(*) c FROM journeys WHERE user_id = ? AND status = 'active'");
    $activeCount->execute([$uid]);
    if ((int) $activeCount->fetch()['c'] >= MAX_ACTIVE_JOURNEYS) {
        json_error('You already have ' . MAX_ACTIVE_JOURNEYS . ' active journeys. Complete one before starting another.', 409);
    }

    $system = "You are Apex Surge's Synthesis Engine. Design a multi-week transformation roadmap
that sequences weekly themes starting with the user's lowest self-assessed scores. Ground it in real,
well-known non-fiction books relevant to the goal. Each week must build on the last.";

    $scoresText = implode(', ', array_map(fn($a) => "{$a['label']}: {$a['v']}/10", $assessment));
    $userMsg = "Goal: \"$goalTitle\" - $goalDescription
Self-assessment (1-10, lower = needs more work): $scoresText
Duration: $weeks weeks.

Respond with JSON exactly:
{
  \"weeks\": [ { \"week\": 1, \"theme\": \"3-5 word theme\", \"focus\": \"one specific skill or practice for the week\" }, ... exactly $weeks entries ],
  \"focusAreas\": [\"3-5 short skill tags drawn from the lowest-scored assessment items\"],
  \"bookRefs\": [\"2-4 real, well-known non-fiction book titles this roadmap draws from\"]
}";

    $result = ask_claude_json($system, $userMsg, 'high', 3000);
    $weeksWithDone = array_map(fn($w) => array_merge($w, ['done' => false]), $result['weeks']);

    $stmt = $pdo->prepare('INSERT INTO journeys (user_id, goal_title, goal_description, weeks, focus_areas, book_refs, assessment, current_week, progress_pct, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?)');
    $stmt->execute([$uid, $goalTitle, $goalDescription, json_encode($weeksWithDone), json_encode($result['focusAreas']), json_encode($result['bookRefs']), json_encode($assessment), 'active']);

    json_out(array_merge(['journeyId' => (int) $pdo->lastInsertId()], $result));
}

if ($action === 'generateTask') {
    $in = json_input();
    $journeyId = (int) ($in['journeyId'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM journeys WHERE id = ? AND user_id = ?');
    $stmt->execute([$journeyId, $uid]);
    $journey = $stmt->fetch();
    if (!$journey) json_error('Journey not found.', 404);

    $weeks = json_decode($journey['weeks'], true);
    $week = $weeks[$journey['current_week'] - 1];
    $bookRefs = json_decode($journey['book_refs'] ?? '[]', true) ?: [];

    $system = "You are Apex Surge's Application Engine. Generate one small, concrete real-world
task (under 15 minutes) for today that practices this week's theme in a journey the user is on.";
    $userMsg = "Journey: \"{$journey['goal_title']}\". This week's theme: \"{$week['theme']}\" - focus: \"{$week['focus']}\".
Books this roadmap draws from: " . implode(', ', $bookRefs) . ".

Respond with JSON exactly: { \"title\": \"one imperative sentence, a concrete task\", \"durationMin\": 8, \"bookRefs\": [\"1-3 of the books listed above most relevant to this task\"] }";

    json_out(ask_claude_json($system, $userMsg, 'medium'));
}

if ($action === 'advanceWeek') {
    $in = json_input();
    $journeyId = (int) ($in['journeyId'] ?? 0);
    $stmt = $pdo->prepare('SELECT * FROM journeys WHERE id = ? AND user_id = ?');
    $stmt->execute([$journeyId, $uid]);
    $journey = $stmt->fetch();
    if (!$journey) json_error('Journey not found.', 404);

    $weeks = json_decode($journey['weeks'], true);
    $currentWeek = (int) $journey['current_week'];
    $nextWeek = min($currentWeek + 1, count($weeks));
    foreach ($weeks as $i => &$w) {
        if ($i < $currentWeek) $w['done'] = true;
    }
    unset($w);
    $doneCount = count(array_filter($weeks, fn($w) => !empty($w['done'])));
    $progressPct = (int) round(($doneCount / count($weeks)) * 100);
    $status = ($nextWeek === $currentWeek && $progressPct === 100) ? 'complete' : 'active';

    if ($status === 'complete') {
        $pdo->prepare('UPDATE journeys SET current_week=?, weeks=?, progress_pct=?, status=?, completed_at=NOW() WHERE id=?')
            ->execute([$nextWeek, json_encode($weeks), $progressPct, $status, $journeyId]);
    } else {
        $pdo->prepare('UPDATE journeys SET current_week=?, weeks=?, progress_pct=?, status=? WHERE id=?')
            ->execute([$nextWeek, json_encode($weeks), $progressPct, $status, $journeyId]);
    }

    json_out(['currentWeek' => $nextWeek, 'progressPct' => $progressPct, 'status' => $status]);
}

json_error('Unknown action.', 404);
