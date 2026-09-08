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
