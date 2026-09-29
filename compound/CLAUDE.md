# CLAUDE.md — Compound

Context for Claude Code working on this repo. Read this first.

## What this is
Compound is an installable **PWA** for learning the best productivity/communication books in ~10 min a day,
with an **apply loop**: selection-based onboarding (no password), skill paths, read/listen insight cards,
an instantly-graded quiz after each lesson, a 2-day field assignment with photo/audio proof, progress +
streaks, and a **live AI coach** (Claude API). There is an **admin panel** for content + submission review.

Target host: **Hostinger shared hosting** — plain **PHP 8** + **MySQL**, no build step, no framework, no
Composer. Keep it that way unless asked; everything must run by uploading files to `public_html`.

## Stack & conventions
- **Frontend:** vanilla JS single-file SPA. No framework, no bundler. Screens are `<section class="screen">`
  toggled by `show(id)`. Dynamic screens are rendered as HTML strings from API data. All user/content strings
  go through `esc()`.
- **Backend:** vanilla PHP, PDO (prepared statements everywhere — no string-built SQL with user input).
  Front controller `api/index.php` maps the first path segment to `routes/<name>.php` and calls
  `route_<name>($method, $segments)`.
- **Auth:** passwordless. `POST auth/request-code` (emails a 6-digit code) → `POST auth/verify-code`
  (returns a bearer token). Token stored in `localStorage['compound_token']`, sent as
  `Authorization: Bearer`. Server checks it in `require_user()` / `require_admin()`.
- **SQL is MySQL-specific** (`ON DUPLICATE KEY`, `DATE_ADD(... INTERVAL)`, `INSERT IGNORE`, `AUTO_INCREMENT`).
  Do not assume SQLite compatibility.
- **Styling:** CSS custom properties in `assets/css/styles.css`. Light + dark via `:root`,
  `@media (prefers-color-scheme)`, and `[data-theme]`. Brand `--brand:#6242F5`, growth/success `--grow`.
- **Never** commit `api/config.php` (secrets). It's git-ignored; `config.sample.php` is the template.

## Layout
```
sql/schema.sql          tables (run first)
sql/seed.sql            Communication path + 6 books (run second; TRUNCATEs content tables, not users)
public/index.html       PWA shell (static onboarding screens live here)
public/assets/js/app.js  the whole SPA (nav, onboarding, auth, reader, quiz, assignment, coach, progress)
public/assets/js/config.js  API_BASE (default '/api')
public/assets/css/styles.css
public/sw.js, manifest.webmanifest, assets/icons/*
public/api/index.php     router → routes/*.php
public/api/config.php    SECRETS (git-ignored) — copy of config.sample.php
public/api/db.php helpers.php claude.php mailer.php
public/api/routes/       auth, onboarding, paths, lessons, quiz, assignments, library, progress, coach, admin
public/api/uploads/      assignment files (private; served only via GET /api/uploads/{id} with auth)
public/admin/            content admin SPA (index.html + admin.js)
```

## Data model (MySQL)
`users, login_codes, sessions, onboarding` · content: `books, book_insights, paths, lessons, cards,
quiz_questions, quiz_options, assignments` · per-user: `user_lesson, user_quiz, user_assignment,
assignment_files, playbook, coach_messages, user_stats`. Content hierarchy: **path → lessons → (cards,
quiz_questions+options, one assignment)**.

## Run locally
There's no MySQL-free path (SQL is MySQL-specific), so use a local MySQL/MariaDB:
1. `mysql -u root -p < sql/schema.sql && mysql -u root -p yourdb < sql/seed.sql`
2. Copy `public/api/config.sample.php` → `public/api/config.php`, set DB creds + Claude key + your
   admin email. For SMTP, point `mail.smtp` at a local catcher (e.g. Mailpit on port 1025,
   `'secure' => 'none'`, no user) and read the code there.
3. Serve the docroot **with the API rewrite**. The simplest correct option is Apache/`php` + the included
   `.htaccess`. `php -S` alone won't apply `.htaccess`, so if you use it, hit the API as
   `/api/index.php?route=...` or add a tiny router. On Hostinger the `.htaccess` handles it.
4. Open the site, go through onboarding, enter email, use the echoed code.

## Deploy (Hostinger)
Import `schema.sql` then `seed.sql` in phpMyAdmin → upload contents of `public/` to `public_html` →
edit `api/config.php` → make `api/uploads/` writable → fill in `mail.smtp` → visit `/admin`
(sign in with an `admin_emails` address). Full steps in `README.md`.

## Gotchas
- Login codes are sent only by email via `api/mailer.php` (SMTP). Never return codes in API responses.
- `fileinfo`, `curl`, `pdo_mysql` PHP extensions must be enabled.
- Uploaded files are private; never expose the `uploads/` dir directly (its `.htaccess` denies access).

## Roadmap / not done yet
- More paths (Productivity, Interview Prep, Leadership) — schema supports it; add a `paths` row with a
  matching `goal` + lessons via admin.
- Assignment-due reminder emails (cron; reuse `send_mail()` from `api/mailer.php`).
- On-demand AI book summaries (Claude client already present in `claude.php`).
- Push notifications for streaks.

When adding a feature: put new endpoints in a `routes/*.php` file exposing `route_<name>`, register it in
the `$map` in `index.php`, and keep queries parameterized.
