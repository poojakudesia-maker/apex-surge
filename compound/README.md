# Compound — PWA + PHP/MySQL

A working installable PWA for learning the best productivity/communication books in ~10 min a day:
selection-based onboarding (no password), skill paths, read/listen insight cards, an instantly-graded
quiz after each lesson, a 2-day field assignment with photo/audio proof, progress + streaks, and a live
AI coach powered by the Claude API. Plus an admin panel to manage content and review submissions.

This is the **first vertical slice**: one complete path (Communicate with Impact) working end to end.

---

## What's in the box

```
compound/
├─ sql/
│  ├─ schema.sql        ← run first (creates tables)
│  └─ seed.sql          ← run second (loads the Communication path + 6 books)
├─ public/              ← upload the CONTENTS of this folder to public_html
│  ├─ index.html        ← the PWA
│  ├─ manifest.webmanifest, sw.js
│  ├─ assets/ (css, js, icons)
│  ├─ admin/            ← content admin at  yourdomain.com/admin
│  └─ api/              ← PHP REST API (yourdomain.com/api)
│     ├─ config.php     ← EDIT THIS (DB creds, Claude key, admin email)
│     ├─ config.sample.php
│     ├─ index.php, db.php, helpers.php, claude.php
│     ├─ routes/*.php
│     └─ uploads/       ← assignment photos/audio are stored here (private)
└─ README.md
```

## Requirements (Hostinger)

- A domain/subdomain on your Hostinger plan
- PHP 8.0+ (set in hPanel → Advanced → PHP Configuration; enable `curl`, `pdo_mysql`, `fileinfo`)
- One MySQL database
- SSL (free with Hostinger) — needed for PWA install, camera and microphone
- A Claude API key from console.anthropic.com (for the AI coach)

---

## Deploy in 8 steps

### 1. Create the database
hPanel → **Databases → MySQL Databases**. Create a database and a user, give the user all
privileges. Note the **database name, user, password** (host is usually `localhost`).

### 2. Import the schema and seed
hPanel → **phpMyAdmin** → open your database →
- **Import** tab → choose `sql/schema.sql` → Go
- **Import** tab → choose `sql/seed.sql` → Go

You now have the Communication path, 6 lessons, quizzes, assignments, and a 6-book library.

### 3. Upload the app
Upload the **contents of `public/`** into `public_html` (File Manager or FTP). You should end up with
`public_html/index.html`, `public_html/api/`, `public_html/admin/`, etc.
(If you host on a subdomain, upload into that subdomain's folder instead.)

### 4. Configure the API
Edit `public_html/api/config.php` and fill in:
- `db` → your database name / user / password
- `claude.api_key` → your Claude API key; set `claude.model` to a model your key can use
  (e.g. `claude-sonnet-4-5`, or a Haiku model for lower cost)
- `mail` → the mailbox that sends sign-in codes (see **Email** below): `from`, and under `smtp` the
  mailbox address and password
- `admin_emails` → your email (this is who can open `/admin`)
- `app_url` → `https://yourdomain.com`

### 5. Permissions
Make sure `public_html/api/uploads/` is writable (chmod `755`, or `775` if uploads fail).
The included `.htaccess` files keep uploads private and route the API — leave them in place.

### 6. Test the API
Visit `https://yourdomain.com/api/ping` — you should see `{"ok":true,...}`.
If you get a database error, re-check step 4.

### 7. Use the app
Open `https://yourdomain.com`. Go through onboarding → enter your email.
- A 6-digit code arrives by email. Enter it to continue; it expires in 10 minutes and only the newest code works.
- Add to Home Screen (iOS Safari: Share → Add to Home Screen; Android Chrome: Install app) to run it as a PWA.

### 8. Open the admin
Go to `https://yourdomain.com/admin`, sign in with an email listed in `admin_emails`.
Manage books, lessons, insight cards, quiz questions, and assignments, and review learner submissions
(photos/audio play inline).

---

## Email (login codes)

Sign-in codes are sent over SMTP by `api/mailer.php` (no Composer or PHPMailer needed).

1. hPanel → **Emails** → create a mailbox such as `no-reply@yourdomain.com`.
2. In `api/config.php` set `mail.from` and `mail.smtp.user` to that address, and `mail.smtp.pass` to its
   password. Hostinger's defaults are already filled in: `smtp.hostinger.com`, port `465`, `ssl`.
   (Other providers: port `587` with `'secure' => 'tls'`.)
3. hPanel → **Emails → DNS / Deliverability**: make sure SPF, DKIM and DMARC show as set, or codes will
   land in spam.

If sending fails the app says so and no code is issued; the reason is written to the PHP error log
(hPanel → Advanced → Error logs), e.g. a wrong mailbox password.

Rules: one code per minute per email (5 per 15 minutes), 5 wrong guesses burns the code, and requesting
a new code invalidates the old one.

---

## AI learning plans

With a Claude API key in `config.php`, onboarding builds a personal plan instead of the curated path:

1. **10 books for the learner's goal.** Claude picks and orders them from the learner's goal, focus areas,
   role, level, daily time and target. A book already in the catalogue is reused; a new one is added and
   flagged for review.
2. **Summaries to read or listen to.** Written once per book and shared by every learner who has that
   book. The first two are written during onboarding, the rest in the background or when a book is opened.
3. **One lesson per book.** Five insight cards and a three-question quiz on the book's most practical
   idea, written the first time any learner reaches that book and reused after that.
4. **A personal SMART goal and field assignment for each lesson**, written for that learner from their
   profile, recent quiz scores and past assignment notes. Shown as insight cards on the assignment
   screen (with a listen button), next to a recap of the lesson, and listed under Progress.

Everything goes live immediately. **Admin → AI review** lists new AI books and lessons: approve, edit,
hide a book, or regenerate. Hidden books are never offered again.

Cost control: `content_model` / `content_effort` in `config.php`. A new learner costs about 2 to 4
Claude calls up front (book list, a couple of summaries, lesson 1), then one small call per lesson for
the SMART goal, plus one call for each book or lesson nobody has needed before. The API errors go to
the PHP error log. PHP's time limit must allow about 3 minutes per request (Hostinger's default is fine;
if you see timeouts, raise `max_execution_time` in hPanel → PHP Configuration).

Without a key the app uses the curated path from `seed.sql`.

---

## Upgrading an existing install

If you already imported `schema.sql` before book summaries existed:

1. phpMyAdmin → your database → **Import**, in order, each migration you haven't run yet:
   `sql/migrations/001_book_summaries.sql`, then `sql/migrations/002_ai_plans.sql`
   ("Duplicate column name" means that part is already there).
2. Import `sql/seed.sql` again. It only replaces the curated content; AI books and learners' personal
   plans are kept.
3. Re-upload the contents of `public/`, keeping your existing `api/config.php`, and add the new
   `mail.smtp` block from `config.sample.php` to it.

---

## How it works (quick map)

- **Auth:** `POST /api/auth/request-code` → emails a code; `POST /api/auth/verify-code` → returns a bearer
  token (stored in the browser). All other calls send `Authorization: Bearer <token>`.
- **Content:** paths → lessons → cards / quiz_questions+options / assignment. Served read-only to learners,
  editable in `/admin`.
- **Quiz:** each answer is graded server-side instantly (`POST /api/quiz/answer`), final score saved on submit.
- **Assignment:** `POST /api/assignments/{lesson}/submit` (multipart) stores photo/audio in `api/uploads/`,
  due 2 days out; files are served back only to the owner or an admin via `GET /api/uploads/{id}`.
- **Library:** `GET /api/library` lists books; `GET /api/books/{id}` returns the blurb, written summary and key
  insights. The book page can read the summary aloud.
- **Coach:** `POST /api/coach` calls the Claude Messages API with the learner's profile as context.
- **Progress:** streak, growth score, weekly activity and Playbook.

---

## Security notes

- `config.php` is blocked from the web by `api/.htaccess`.
- Uploads can't be executed or listed directly; they're only reachable through the authenticated endpoint.
- Login codes are hashed, expire in 10 minutes, and are rate-limited.
- Turn on the HTTPS redirect (commented block at the bottom of `public/.htaccess`) once SSL is active.

---

## What's next (later sessions)

- More paths (Productivity, Interview Prep, Leadership) — the structure already supports them; just add a
  `paths` row with a matching `goal` and its lessons in the admin.
- AI-generated summaries on demand (the Claude client is already here).
- Email reminders when an assignment is due (a cron job hitting a small PHP script).
- Push notifications for streaks.

Tell me which to build next and I'll extend this same codebase.
