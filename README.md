# Apex Surge — Clickable Prototype

**Apex Surge** is an AI "Knowledge-to-Life" product: instead of another book-summary reader, it turns ideas from the world's best books into personalized, real-world experiments — then tracks what happens and adapts.

> Don't just learn what the world's best books say. Tell us what you're trying to change, and we'll turn the ideas from those books into a personalized program that helps you actually change.

## What's in this repo

`docs/` contains a **fully clickable, screen-to-screen interactive prototype** of the app — pure HTML/CSS/JavaScript, no build step, no backend. Every button, chip, slider and card routes to a real screen with real (mocked) state, so you can walk the entire product end-to-end.

### View it live

Once GitHub Pages is enabled for this repo (Settings → Pages → Source: **Deploy from a branch** → Branch: `main` (or this branch) → Folder: `/docs`), the prototype is live at:

```
https://poojakudesia-maker.github.io/apex-surge/
```

### Run it locally

No install needed — it's static:

```bash
cd docs
python3 -m http.server 8080
# open http://localhost:8080
```

Or just double-click `docs/index.html` to open it directly in a browser.

## Flows covered in the prototype

The left rail in the prototype lets you jump straight to any flow:

1. **Onboarding** — why you want to grow → life areas → biggest challenge → daily time → learning style → AI builds your Growth Profile → your first 7-day journey
2. **Today / Daily Loop** — micro-lesson → interactive check → "apply this to you" reflection → AI-generated personal pattern → real-world behavior experiment → day-by-day tracking → adaptive reflection → mission complete
3. **Explore a Book** — why this book is relevant to *you* → key idea → quiz → "Apply this to my life" → generated experiment → saved to Playbook
4. **My Growth Journey** — pick a transformation goal → self-assessment sliders → AI-generated multi-week roadmap → journey detail (progress ring, today's mission) → completion screen
5. **AI Coach + Roleplay** — describe a real situation → AI answers using *your* learned books and history → practice the conversation via roleplay → scored feedback
6. **Personal Playbook** — Principles / Insights / Experiments / What Works For Me / Knowledge Graph (ideas learned → applied → adopted, application rate)
7. **Weekly Review** — what you learned, applied and what failed → AI-detected behavior pattern → next week's plan is adapted automatically

## Product philosophy

This prototype implements the product direction of **"Learn → Apply → Experiment → Measure → Adapt"** rather than a pure content-consumption loop (read → recommend another book). Content, book titles and framework names used are illustrative placeholders for prototyping purposes only.

## Tech notes

- Zero dependencies, zero build step — plain HTML/CSS/JS (`docs/js/data.js`, `state.js`, `screens.js`, `app.js`).
- State persists to `localStorage` so a refresh doesn't lose your place. Use **"Reset prototype state"** in the left rail to start over.
- Designed as a single scrollable phone frame with a bottom tab bar (Today / Explore / My Growth / Playbook / Coach), matching native mobile app conventions.
