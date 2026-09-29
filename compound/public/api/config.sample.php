<?php
/**
 * Compound API configuration.
 * COPY this file to `config.php` and fill in your values.
 * config.php is git-ignored and never shipped.
 */
return [
  // ---- MySQL (from Hostinger hPanel > Databases > MySQL) ----
  'db' => [
    'host'    => 'localhost',
    'name'    => 'REPLACE_DB_NAME',
    'user'    => 'REPLACE_DB_USER',
    'pass'    => 'REPLACE_DB_PASSWORD',
    'charset' => 'utf8mb4',
  ],

  // ---- Claude API (console.anthropic.com > API keys) ----
  'claude' => [
    'api_key'    => 'sk-ant-REPLACE',
    'model'      => 'claude-sonnet-4-5',   // AI coach chat; change to any model your key can use
    'max_tokens' => 1024,
    // AI plans: picking each learner's 10 books, summaries, lessons and SMART goals.
    // Needs a model with structured outputs. Lower effort ('low') is cheaper and faster.
    'content_model'  => 'claude-opus-5-5',
    'content_effort' => 'medium',
    'version'    => '2023-06-01',
  ],

  // ---- Email (sign-in codes are sent over SMTP) ----
  // Hostinger: hPanel > Emails > create a mailbox (e.g. no-reply@yourdomain.com),
  // then use that mailbox's address and password below. `from` must be the same
  // mailbox (or an alias of it) or the message will be rejected / marked as spam.
  'mail' => [
    'from'      => 'no-reply@REPLACE_DOMAIN.com',
    'from_name' => 'Compound',
    'smtp' => [
      'host'    => 'smtp.hostinger.com',
      'port'    => 465,                          // 465 = SSL, 587 = STARTTLS
      'secure'  => 'ssl',                        // 'ssl' | 'tls' | 'none'
      'user'    => 'no-reply@REPLACE_DOMAIN.com',
      'pass'    => 'REPLACE_MAILBOX_PASSWORD',
      'timeout' => 15,
    ],
  ],

  // ---- App ----
  'app_url'        => 'https://REPLACE_DOMAIN.com',
  'admin_emails'   => ['you@REPLACE_DOMAIN.com'],   // these users get admin access
  'code_ttl_min'   => 10,     // login code lifetime
  'session_ttl_days' => 60,   // how long a login lasts
  'upload_max_mb'  => 15,     // per assignment file
];
