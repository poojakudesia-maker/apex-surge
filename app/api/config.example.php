<?php
/**
 * Copy this file to config.php (same folder) and fill in your real values.
 * config.php is git-ignored and blocked from direct web access by .htaccess —
 * never commit your real database password or Anthropic key.
 */

// --- Database (from Hostinger hPanel -> Databases -> MySQL Databases) ---
define('DB_HOST', 'localhost');
define('DB_NAME', 'your_database_name');
define('DB_USER', 'your_database_user');
define('DB_PASS', 'your_database_password');

// --- Anthropic (from console.anthropic.com) ---
define('ANTHROPIC_API_KEY', 'sk-ant-...');
// Only needed if your Anthropic account uses Workspaces and your key requires it
// (you'll see an error mentioning "anthropic-workspace-id" if so). Leave blank otherwise.
define('ANTHROPIC_WORKSPACE_ID', '');

// --- Email (for the signup verification code) ---
// Create a real mailbox in Hostinger hPanel -> Emails -> create an account
// (e.g. no-reply@yourdomain.com), then fill in its SMTP details below —
// find them under that email account's "Configure email client" / SMTP
// settings. Leave SMTP_HOST blank to fall back to PHP's plain mail(),
// which works on some hosts but is far less reliable.
define('SMTP_HOST', ''); // e.g. 'smtp.hostinger.com'
define('SMTP_PORT', 587); // 587 = STARTTLS (recommended), 465 = SSL
define('SMTP_SECURE', 'tls'); // 'tls', 'ssl', or '' to match your port above
define('SMTP_USER', ''); // the full mailbox address, e.g. 'no-reply@yourdomain.com'
define('SMTP_PASS', ''); // that mailbox's password
define('SMTP_FROM', ''); // usually the same as SMTP_USER
