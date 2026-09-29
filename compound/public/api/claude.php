<?php
/** Minimal Claude (Anthropic Messages API) client via cURL. */

/**
 * @param array  $messages  [['role'=>'user'|'assistant','content'=>string], ...]
 * @param string $system    system prompt
 * @param int    $maxTokens optional override
 * @return array ['ok'=>bool, 'text'=>string, 'error'=>string|null]
 */
function claude_message($messages, $system = '', $maxTokens = null) {
  $c = cfg('claude');
  if (empty($c['api_key']) || strpos($c['api_key'], 'REPLACE') !== false) {
    return ['ok' => false, 'text' => '', 'error' => 'claude_not_configured'];
  }
  $payload = [
    'model'      => $c['model'],
    'max_tokens' => $maxTokens ?: (int)$c['max_tokens'],
    'messages'   => array_values($messages),
  ];
  if ($system !== '') $payload['system'] = $system;

  $ch = curl_init('https://api.anthropic.com/v1/messages');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_TIMEOUT        => 45,
    CURLOPT_HTTPHEADER     => [
      'content-type: application/json',
      'x-api-key: ' . $c['api_key'],
      'anthropic-version: ' . ($c['version'] ?? '2023-06-01'),
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
  ]);
  $res  = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);

  if ($res === false) return ['ok' => false, 'text' => '', 'error' => 'curl: ' . $err];
  $data = json_decode($res, true);
  if ($code >= 400) {
    $m = $data['error']['message'] ?? ('http_' . $code);
    return ['ok' => false, 'text' => '', 'error' => $m];
  }
  $text = '';
  foreach (($data['content'] ?? []) as $block) {
    if (($block['type'] ?? '') === 'text') $text .= $block['text'];
  }
  return ['ok' => true, 'text' => trim($text), 'error' => null];
}

/** True when an API key is set, so AI plans can be generated. */
function claude_configured() {
  $c = cfg('claude') ?: [];
  return !empty($c['api_key']) && strpos($c['api_key'], 'REPLACE') === false;
}

/**
 * One structured-output call for app content (book plans, summaries, lessons, SMART goals).
 * Returns the decoded JSON object, or null on failure (reason goes to the PHP error log).
 * Uses cfg('claude')['content_model'] (default claude-opus-5-5), separate from the coach's model.
 */
function claude_json($system, $prompt, $schema, $maxTokens = 8000, $effort = null) {
  if (!claude_configured()) return null;
  $c = cfg('claude');
  $model  = $c['content_model'] ?? 'claude-opus-5-5';
  $effort = $effort ?: ($c['content_effort'] ?? 'medium');

  $payload = [
    'model'         => $model,
    'max_tokens'    => $maxTokens,
    'system'        => $system,
    'messages'      => [['role' => 'user', 'content' => $prompt]],
    'output_config' => ['effort' => $effort, 'format' => ['type' => 'json_schema', 'schema' => $schema]],
  ];
  $headers = [
    'content-type: application/json',
    'x-api-key: ' . $c['api_key'],
    'anthropic-version: ' . ($c['version'] ?? '2023-06-01'),
  ];
  // If a safety classifier declines, let the API retry on its recommended fallback model.
  if (preg_match('/^claude-(opus-5|fable-5|sonnet-5-5)/', $model)) {
    $payload['fallbacks'] = 'default';
    $headers[] = 'anthropic-beta: server-side-fallback-2026-07-01';
  }

  @set_time_limit(180);
  $ch = curl_init($c['api_url'] ?? 'https://api.anthropic.com/v1/messages');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_CONNECTTIMEOUT => 15,
    CURLOPT_TIMEOUT        => 170,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
  ]);
  $res  = curl_exec($ch);
  $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);

  if ($res === false) { error_log('[claude_json] curl: ' . $err); return null; }
  $data = json_decode($res, true);
  if ($code >= 400) { error_log('[claude_json] HTTP ' . $code . ': ' . ($data['error']['message'] ?? substr($res, 0, 300))); return null; }
  $stop = $data['stop_reason'] ?? '';
  if ($stop === 'refusal' || $stop === 'max_tokens') { error_log('[claude_json] stop_reason ' . $stop); return null; }

  $text = '';
  foreach (($data['content'] ?? []) as $block) {
    if (($block['type'] ?? '') === 'text') $text .= $block['text'];
  }
  $out = json_decode($text, true);
  if (!is_array($out)) { error_log('[claude_json] could not decode JSON output'); return null; }
  return $out;
}

/** JSON-schema helper: an object whose listed properties are all required. */
function js_obj($props) {
  return ['type' => 'object', 'properties' => $props, 'required' => array_keys($props), 'additionalProperties' => false];
}
function js_str($desc = null) { return $desc ? ['type' => 'string', 'description' => $desc] : ['type' => 'string']; }
function js_arr($items, $desc = null) { $a = ['type' => 'array', 'items' => $items]; if ($desc) $a['description'] = $desc; return $a; }
