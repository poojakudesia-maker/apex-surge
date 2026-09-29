<?php
/**
 * Minimal SMTP mailer (no Composer). Sends one message per call over
 * SSL (port 465), STARTTLS (port 587) or plain SMTP, with AUTH LOGIN.
 * Configure under cfg('mail')['smtp']. Errors go to the PHP error log,
 * never to the client.
 */

/** Send an email. Returns true on success. $text is required, $html optional. */
function send_mail($to, $subject, $text, $html = null) {
  $m = cfg('mail') ?: [];
  $smtp = $m['smtp'] ?? null;
  $from = $m['from'] ?? '';
  $from_name = $m['from_name'] ?? 'Compound';

  if (!$from || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
    error_log('[mailer] mail.from is not a valid address');
    return false;
  }
  if (empty($smtp['host'])) {
    error_log('[mailer] mail.smtp.host is not configured');
    return false;
  }

  $message = mail_build_message($from, $from_name, $to, $subject, $text, $html);
  try {
    smtp_send($smtp, $from, $to, $message);
    return true;
  } catch (Throwable $e) {
    error_log('[mailer] send to ' . $to . ' failed: ' . $e->getMessage());
    return false;
  }
}

function mail_encode_header($s) {
  return preg_match('/[^\x20-\x7E]/', $s) ? '=?UTF-8?B?' . base64_encode($s) . '?=' : $s;
}

function mail_build_message($from, $from_name, $to, $subject, $text, $html) {
  $domain = substr(strrchr($from, '@'), 1);
  $headers = [
    'Date: ' . date('r'),
    'From: ' . mail_encode_header($from_name) . ' <' . $from . '>',
    'To: <' . $to . '>',
    'Subject: ' . mail_encode_header($subject),
    'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
    'MIME-Version: 1.0',
    'Auto-Submitted: auto-generated',
  ];

  $b64 = fn($s) => rtrim(chunk_split(base64_encode($s), 76, "\r\n"));
  if ($html === null) {
    $headers[] = 'Content-Type: text/plain; charset=UTF-8';
    $headers[] = 'Content-Transfer-Encoding: base64';
    $body = $b64($text);
  } else {
    $boundary = 'b_' . bin2hex(random_bytes(12));
    $headers[] = 'Content-Type: multipart/alternative; boundary="' . $boundary . '"';
    $body =
      "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" .
      $b64($text) . "\r\n" .
      "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" .
      $b64($html) . "\r\n" .
      "--$boundary--";
  }
  return implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n";
}

function smtp_send($c, $from, $to, $message) {
  $host    = $c['host'];
  $port    = (int)($c['port'] ?? 465);
  $secure  = strtolower($c['secure'] ?? ($port === 465 ? 'ssl' : 'tls')); // ssl | tls | none
  $timeout = (int)($c['timeout'] ?? 15);

  $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true]]);
  $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
  $fp = @stream_socket_client($remote, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $ctx);
  if (!$fp) throw new RuntimeException("connect $remote failed: $errstr ($errno)");
  stream_set_timeout($fp, $timeout);

  try {
    smtp_expect($fp, 220);
    $ehlo = 'EHLO ' . (parse_url(cfg('app_url') ?: '', PHP_URL_HOST) ?: 'localhost');
    smtp_cmd($fp, $ehlo, 250);

    if ($secure === 'tls') {
      smtp_cmd($fp, 'STARTTLS', 220);
      if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        throw new RuntimeException('STARTTLS negotiation failed');
      }
      smtp_cmd($fp, $ehlo, 250);
    }

    if (!empty($c['user'])) {
      smtp_cmd($fp, 'AUTH LOGIN', 334);
      smtp_cmd($fp, base64_encode($c['user']), 334);
      smtp_cmd($fp, base64_encode((string)($c['pass'] ?? '')), 235, true);
    }

    smtp_cmd($fp, 'MAIL FROM:<' . $from . '>', 250);
    smtp_cmd($fp, 'RCPT TO:<' . $to . '>', [250, 251]);
    smtp_cmd($fp, 'DATA', 354);
    // dot-stuffing: lines starting with "." get an extra "."
    $data = preg_replace('/^\./m', '..', $message);
    smtp_cmd($fp, $data . '.', 250);
    @fwrite($fp, "QUIT\r\n");
  } finally {
    fclose($fp);
  }
}

function smtp_cmd($fp, $line, $expect, $secret = false) {
  if (fwrite($fp, $line . "\r\n") === false) throw new RuntimeException('write failed');
  return smtp_expect($fp, $expect, $secret ? '[credentials]' : strtok($line, "\r\n"));
}

function smtp_expect($fp, $expect, $sent = '') {
  $resp = '';
  while (($l = fgets($fp, 1024)) !== false) {
    $resp .= $l;
    if (strlen($l) < 4 || $l[3] !== '-') break; // last line of a multi-line reply
  }
  $code = (int)substr($resp, 0, 3);
  if (!in_array($code, (array)$expect, true)) {
    throw new RuntimeException('SMTP ' . ($sent ? "after '$sent' " : '') . 'got: ' . trim($resp ?: 'no response'));
  }
  return $resp;
}
