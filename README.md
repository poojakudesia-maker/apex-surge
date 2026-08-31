# Apex Surge

**Apex Surge** is an AI "Knowledge-to-Life" product: instead of another book-summary reader, it turns ideas from the world's best books into personalized, real-world experiments — then tracks what happens and adapts.

> Don't just learn what the world's best books say. Tell us what you're trying to change, and we'll turn the ideas from those books into a personalized program that helps you actually change.

## What's in this repo

| Path | What it is |
|---|---|
| `app/` | **The real, functional app.** Vanilla-JS PWA + Firebase (Auth, Firestore, Cloud Functions) + live Claude calls. See **[SETUP.md](./SETUP.md)** to deploy it. |
| `functions/` | Cloud Functions (TypeScript) — every AI moment (lessons, personal diagnosis, experiments, coach, roleplay, weekly review) is a server-side call to `claude-opus-5`. The Anthropic key never touches the browser. |
| `firestore.rules` | Per-user data isolation — a user can only read/write their own data. |
| `scripts/` | One-time admin script to seed the public book catalog. |
| `docs/` | The original **clickable, mocked prototype** (no backend) — kept for quick UX walkthroughs. Live at `https://poojakudesia-maker.github.io/apex-surge/` once GitHub Pages is enabled for `/docs`. |

**Start with [SETUP.md](./SETUP.md)** to configure secrets and deploy the real app.

## Product loop

```
Onboarding → Today's lesson (Claude-authored) → "Apply this to you" reflection
  → AI-diagnosed pattern + a scheduled real-world experiment → day-by-day tracking
  → adaptive check-ins → Playbook accumulates what Apex Surge learns about you
  → AI Coach (grounded in your history) → Roleplay practice + scoring
  → Weekly Review → next week's plan adapts
```

Every step above calls Claude live, through a Firebase Cloud Function, and every artifact
(lessons, patterns, experiments, journeys, playbook entries, coach threads, roleplay transcripts,
weekly reviews) is a real Firestore document scoped to the signed-in user.

## Product philosophy

**"Learn → Apply → Experiment → Measure → Adapt"** rather than a pure content-consumption loop
(read → recommend another book). The book is the knowledge source; the product is the change.

## Prototype (docs/)

The original clickable, no-backend walkthrough is still in `docs/` for fast UX review — pure
HTML/CSS/JS, `localStorage`-backed, zero dependencies. Open `docs/index.html` directly, or serve it:

```bash
cd docs && python3 -m http.server 8080
```
