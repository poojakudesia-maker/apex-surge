<?php
/**
 * Minimal SMTP client (raw sockets, no library/Composer needed) for sending
 * the signup verification email through Hostinger's own mail service —
 * far more reliable than PHP's plain mail() on shared hosting.
 *
 * Falls back to mail() automatically if SMTP_HOST isn't configured, so
 * local development without an SMTP mailbox still works.
 */
function smtp_send_mail(string $to, string $subject, string $body): bool {
    if (!defined('SMTP_HOST') || SMTP_HOST === '') {
        $headers = 'From: ' . (defined('SMTP_FROM') && SMTP_FROM !== '' ? SMTP_FROM : ('no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'apexsurge.app')));
        return @mail($to, $subject, $body, $headers);
    }

    $host = SMTP_HOST;
    $port = defined('SMTP_PORT') && SMTP_PORT ? (int) SMTP_PORT : 587;
    $secure = defined('SMTP_SECURE') ? SMTP_SECURE : 'tls'; // 'tls', 'ssl', or ''
    $user = SMTP_USER;
    $pass = SMTP_PASS;
    $from = defined('SMTP_FROM') && SMTP_FROM !== '' ? SMTP_FROM : $user;

    $transport = ($secure === 'ssl') ? 'ssl://' : '';
    $sock = @stream_socket_client("$transport$host:$port", $errno, $errstr, 15);
    if (!$sock) { error_log("SMTP connect failed: $errstr ($errno)"); return false; }

    $read = function () use ($sock) {
        $data = '';
        while ($line = fgets($sock, 515)) {
            $data .= $line;
            if (isset($line[3]) && $line[3] === ' ') break; // last line of a multi-line reply
        }
        return $data;
    };
    $write = function (string $cmd) use ($sock) { fwrite($sock, $cmd . "\r\n"); };

    $expect = function (string $data, string $code) {
        return strpos($data, $code) === 0 || strpos($data, "\n$code") !== false;
    };

    $read(); // greeting
    $write('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    $ehloResp = $read();

    if ($secure === 'tls') {
        $write('STARTTLS');
        $read();
        stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        $write('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost'));
        $read();
    }

    if ($user !== '') {
        $write('AUTH LOGIN');
        $read();
        $write(base64_encode($user));
        $read();
        $write(base64_encode($pass));
        $authResp = $read();
        if (!$expect($authResp, '235')) { error_log('SMTP auth failed: ' . $authResp); fclose($sock); return false; }
    }

    $write("MAIL FROM:<$from>");
    $read();
    $write("RCPT TO:<$to>");
    $read();
    $write('DATA');
    $read();

    $headers = "From: Apex Surge <$from>\r\nTo: <$to>\r\nSubject: $subject\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n";
    $escapedBody = preg_replace('/^\./m', '..', $body); // dot-stuffing per SMTP spec
    $write($headers . "\r\n" . $escapedBody . "\r\n.");
    $sendResp = $read();

    $write('QUIT');
    fclose($sock);

    return $expect($sendResp, '250');
}
