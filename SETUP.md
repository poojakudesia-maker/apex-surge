# Apex Surge — Setup & Deploy (Hostinger, no Firebase)

Everything now runs on Hostinger: the website files, the database, and the server-side code that
calls Claude. No Firebase, no Google Cloud, no command-line tool to install. Everything below is
done through Hostinger's **hPanel** (File Manager + phpMyAdmin) in a web browser.

## 1. Create the database

hPanel → **Databases → MySQL Databases** → create a new database and a database user with a
password. Note down all four values — you'll need them in Step 3:

- Database host (usually `localhost`)
- Database name
- Database username
- Database password

## 2. Create the tables

hPanel → **Databases → phpMyAdmin** → open your new database → click the **SQL** tab → open
`app/sql/schema.sql` from this project, copy its entire contents, paste into the SQL box → click
**Go**. This creates every table the app needs and seeds the book catalog. One-time step.

## 3. Configure your secrets

In `app/api/`, duplicate `config.example.php` and rename the copy to `config.php`. Open it and fill
in:

- The four database values from Step 1
- Your Anthropic API key (from console.anthropic.com)
- `ANTHROPIC_WORKSPACE_ID` — only fill this in if your Anthropic account uses Workspaces (you'll
  know because you'll see an error mentioning `anthropic-workspace-id` if it's needed)

`config.php` is never uploaded anywhere public-facing beyond your own hosting, and `.htaccess`
in the same folder blocks anyone from viewing it directly in a browser.

## 4. Upload

Upload the **contents** of the `app` folder (not the folder itself) into `public_html` via
hPanel File Manager — same as before. You should end up with `public_html/index.html`,
`public_html/css/`, `public_html/js/`, `public_html/api/`, `public_html/sql/`.

## 5. Visit your site

Open your domain. You'll see a real sign-in screen (email + password — create an account right
there, no Google account needed). Onboard, and the first lesson is written live by Claude.

## Local development (optional, for testing changes before uploading)

If you want to test on your own computer first:

```bash
cd app
php -S localhost:8000
```

You'll also need a local MySQL/MariaDB database (e.g. via XAMPP, MAMP, or Docker) with the same
schema imported, and a local `config.php` pointing at it. Then open `http://localhost:8000`.

## What's real vs. what's mocked

Everything is real:

- **Auth**: email + password, hashed with PHP's `password_hash`, sessions via secure cookies.
- **Data**: MySQL, scoped per-user — every query filters by the signed-in user's id; there is no
  client-side database access at all, only your own PHP endpoints.
- **AI**: every generative moment — onboarding's Growth Profile + first lesson, daily lessons,
  reflection → pattern + experiment diagnosis, book-to-life application, roadmap generation,
  journey tasks, the AI Coach chat, roleplay (both sides) and its scoring, and the weekly review
  synthesis — is a live call to `claude-opus-5` from PHP running on your own hosting. Nothing is
  hardcoded or templated client-side, and your Anthropic key never reaches the browser.

## Architecture

```
app/ (everything uploaded to public_html)
  index.html, css/style.css
  js/api.js      — fetch() wrappers over the PHP endpoints below
  js/state.js    — client-side session cache
  js/screens.js  — every screen's render() + after() (event binding)
  js/app.js      — nav engine (go/back/tabs) + auth/session bootstrap

  api/ (PHP, runs on Hostinger's built-in PHP — no install needed)
    config.php       — your secrets (git-ignored; copy from config.example.php)
    db.php           — PDO/MySQL connection
    helpers.php      — session guard, JSON I/O, global error handler
    anthropic.php    — raw-HTTPS Claude client (no Composer/SDK dependency)
    auth.php         — register / login / logout / me
    onboarding.php   — Growth Profile + first lesson
    missions.php     — daily mission lifecycle (lesson, quiz, diagnose, experiment, complete)
    explore.php      — book catalog + "apply to my life"
    growth.php       — journeys: roadmap generation, tasks, weekly advance
    coach.php        — AI Coach chat, grounded in the user's own history
    roleplay.php     — roleplay turns + scoring
    playbook.php     — principles / insights / what-works / experiments
    weekly.php       — weekly review synthesis

  sql/schema.sql — paste into phpMyAdmin once, creates all tables + seeds the book catalog
```

## Cost controls

Same as before — this didn't change: go to **console.anthropic.com → Billing** and set a monthly
spend limit/alert before opening the app up to real users. Hosting cost is whatever your existing
Hostinger plan already costs you; there's no separate cloud bill anymore.
