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
    'model'      => 'claude-sonnet-4-5',   // change to any model your key can use
    'max_tokens' => 1024,
    'version'    => '2023-06-01',
  ],

  // ---- Email (passwordless login codes) ----
  // Default uses PHP mail(). For reliability on Hostinger, set up an email
  // account and consider SMTP (see README). from = a real mailbox on your domain.
  'mail' => [
    'from'      => 'no-reply@REPLACE_DOMAIN.com',
    'from_name' => 'Compound',
  ],

  // ---- App ----
  'app_url'        => 'https://REPLACE_DOMAIN.com',
  'admin_emails'   => ['you@REPLACE_DOMAIN.com'],   // these users get admin access
  'code_ttl_min'   => 10,     // login code lifetime
  'session_ttl_days' => 60,   // how long a login lasts
  'upload_max_mb'  => 15,     // per assignment file
  'dev_echo_code'  => false,  // TRUE only while testing: returns the login code in the API response so you can log in without email working
];
