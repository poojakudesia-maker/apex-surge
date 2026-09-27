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
