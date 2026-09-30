<?php
/**
 * Email Service - Send verification OTPs
 */

class EmailService {
  public static function sendVerificationCode($email, $code) {
    $subject = 'RunFlowTest Email Verification';

    $html = <<<HTML
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; }
        .container { max-width: 500px; margin: 40px auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #000; font-size: 28px; margin: 0 0 16px 0; }
        .code { background: #f0f0f0; font-size: 32px; font-weight: bold; letter-spacing: 4px; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0; font-family: monospace; }
        .note { color: #666; font-size: 14px; margin-top: 16px; }
        .footer { color: #999; font-size: 12px; margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Verify Your Email</h1>
        <p>Enter this code to verify your RunFlowTest account:</p>
        <div class="code">$code</div>
        <p class="note">This code expires in 10 minutes.</p>
        <div class="footer">
          <p>If you didn't request this code, you can safely ignore this email.</p>
          <p>&copy; RunFlowTest. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
    HTML;

    return self::send($email, $subject, $html);
  }

  private static function send($to, $subject, $html) {
    $plaintext = strip_tags($html);

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type: text/html; charset=UTF-8\r\n";
    $headers .= "From: " . MAIL_FROM_NAME . " <" . MAIL_FROM . ">\r\n";
    $headers .= "Reply-To: " . MAIL_FROM . "\r\n";

    if (MAIL_DRIVER === 'smtp') {
      return self::sendViaSMTP($to, $subject, $html, $headers);
    } else {
      return mail($to, $subject, $html, $headers);
    }
  }

  private static function sendViaSMTP($to, $subject, $html, $headers) {
    // Using PHP's built-in mail() for simplicity
    // For production, use PHPMailer or SwiftMailer
    ini_set('SMTP', MAIL_HOST);
    ini_set('smtp_port', MAIL_PORT);
    ini_set('sendmail_from', MAIL_FROM);

    return mail($to, $subject, $html, $headers);
  }
}
