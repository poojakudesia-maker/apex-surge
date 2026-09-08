<?php
/**
 * Minimal Claude API client over raw HTTPS (cURL) — no Composer/SDK needed,
 * since most Hostinger shared-hosting PHP has no package manager access.
 * Talks directly to https://api.anthropic.com/v1/messages.
 */

const CLAUDE_MODEL = 'claude-opus-5';

function claude_request(array $system, array $messages, string $effort = 'medium', int $maxTokens = 1200): array {
    $body = [
        'model' => CLAUDE_MODEL,
        'max_tokens' => $maxTokens,
        'system' => $system,
        'output_config' => ['effort' => $effort],
        'messages' => $messages,
    ];

    $headers = [
        'content-type: application/json',
        'x-api-key: ' . ANTHROPIC_API_KEY,
        'anthropic-version: 2023-06-01',
    ];
    if (defined('ANTHROPIC_WORKSPACE_ID') && ANTHROPIC_WORKSPACE_ID !== '') {
        $headers[] = 'anthropic-workspace-id: ' . ANTHROPIC_WORKSPACE_ID;
    }

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 90,
    ]);
    $raw = curl_exec($ch);
    if ($raw === false) {
        $err = curl_error($ch);
        curl_close($ch);
        throw new Exception('Could not reach Claude: ' . $err);
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    if ($status >= 400) {
        $msg = $decoded['error']['message'] ?? ('Claude API error ' . $status);
        throw new Exception($msg);
    }
    return $decoded;
}

function claude_extract_text(array $response): string {
    $parts = [];
    foreach (($response['content'] ?? []) as $block) {
        if (($block['type'] ?? '') === 'text') $parts[] = $block['text'];
    }
    return trim(implode("\n", $parts));
}

function claude_system_block(string $text): array {
    return [['type' => 'text', 'text' => $text]];
}

/** Plain-text completion (coach/roleplay single-turn convenience). */
function ask_claude_text(string $system, string $userMessage, string $effort = 'medium', int $maxTokens = 1200): string {
    $response = claude_request(claude_system_block($system), [
        ['role' => 'user', 'content' => $userMessage],
    ], $effort, $maxTokens);
    return claude_extract_text($response);
}

/** Multi-turn completion — $history is a list of ['role'=>..,'content'=>..]. */
function ask_claude_conversation(string $system, array $history, string $effort = 'medium', int $maxTokens = 1200): string {
    $response = claude_request(claude_system_block($system), $history, $effort, $maxTokens);
    return claude_extract_text($response);
}

/** Completion constrained to return parseable JSON. */
function ask_claude_json(string $system, string $userMessage, string $effort = 'high', int $maxTokens = 2000): array {
    $jsonSystem = $system . "\n\nRespond with ONLY a single valid JSON object or array. No markdown fences, no commentary, no text before or after the JSON.";
    $response = claude_request(claude_system_block($jsonSystem), [
        ['role' => 'user', 'content' => $userMessage],
    ], $effort, $maxTokens);
    $raw = claude_extract_text($response);
    return parse_json_loose($raw);
}

function parse_json_loose(string $raw): array {
    $cleaned = trim($raw);
    $cleaned = preg_replace('/^```(?:json)?/i', '', $cleaned);
    $cleaned = preg_replace('/```$/', '', $cleaned);
    $cleaned = trim($cleaned);
    $data = json_decode($cleaned, true);
    if (is_array($data)) return $data;

    $start = null;
    foreach (['{', '['] as $ch) {
        $pos = strpos($cleaned, $ch);
        if ($pos !== false && ($start === null || $pos < $start)) $start = $pos;
    }
    $end = max(strrpos($cleaned, '}') ?: -1, strrpos($cleaned, ']') ?: -1);
    if ($start !== null && $end > $start) {
        $data = json_decode(substr($cleaned, $start, $end - $start + 1), true);
        if (is_array($data)) return $data;
    }
    throw new Exception('Claude did not return parseable JSON: ' . substr($raw, 0, 300));
}
