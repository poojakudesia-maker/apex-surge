# Apex Surge — Setup & Deploy

This is the real, functional app: React-free vanilla-JS PWA (`app/`) + Firebase (Auth, Firestore,
Cloud Functions, Hosting) + Claude (via a server-side Cloud Function — the Anthropic key never
touches the browser). Firebase project: **thrive-9a736**.

## 0. One-time prerequisites

```bash
npm install -g firebase-tools
firebase login
```

Make sure the CLI is pointed at the right project (already set in `.firebaserc`):

```bash
firebase use thrive-9a736
```

## 1. Enable Google sign-in

In the [Firebase Console](https://console.firebase.google.com/project/thrive-9a736/authentication/providers) →
Authentication → Sign-in method → enable **Google**. Add your app's authorized domain
(e.g. `thrive-9a736.web.app`, and `localhost` for local dev — usually pre-added).

## 2. Set the Anthropic API key as a Cloud Functions secret

**Do this yourself in your terminal — never paste the key into chat.**

```bash
cd functions
firebase functions:secrets:set ANTHROPIC_API_KEY
# paste your Anthropic API key when prompted
```

This stores it in Google Secret Manager; `onboarding.ts` binds it via `secrets: [anthropicKey]` on
every function that calls Claude, and the Anthropic SDK reads it from `process.env.ANTHROPIC_API_KEY`
at runtime. It is never written to source, logs, or the client bundle.

## 3. Install dependencies

```bash
cd functions && npm install && cd ..
cd scripts && npm install && cd ..
```

(`app/` needs no install — it loads the Firebase Web SDK straight from the `gstatic.com` CDN as ES
modules, no bundler required.)

## 4. Seed the book catalog (one time)

```bash
gcloud auth application-default login   # if you haven't already
cd scripts && node seedBooks.mjs
```

This writes ~8 real, well-known non-fiction books into the public `books` Firestore collection that
the Explore tab reads from.

## 5. Deploy

```bash
# from the repo root
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting
```

This builds the TypeScript functions (`npm run build` runs automatically as a predeploy hook),
deploys all 14 Cloud Functions, publishes Firestore security rules, and pushes `app/` to Firebase
Hosting. Your live app will be at:

```
https://thrive-9a736.web.app
```

## Local development (with emulators)

```bash
firebase emulators:start --only auth,firestore,functions
```

Then in another terminal, serve `app/` with any static server, e.g.:

```bash
cd app && python3 -m http.server 8935
```

Open `http://localhost:8935` — `app/js/firebase.js` auto-detects `localhost` and connects to the
local Auth/Firestore/Functions emulators instead of production, so you can develop and test without
touching real data. (The functions emulator still needs `ANTHROPIC_API_KEY` — either run
`firebase functions:secrets:set` once so the emulator can read the stored secret, or export it in
your shell before starting the emulator: `ANTHROPIC_API_KEY=sk-... firebase emulators:start ...`.)

## What's real vs. what's mocked

Everything is real:

- **Auth**: Google sign-in via Firebase Auth.
- **Data**: Firestore, scoped per-user by security rules (`firestore.rules`) — a user can only
  read/write their own subtree; the `books` catalog is public-read, write-locked to admin scripts.
- **AI**: every generative moment — onboarding's Growth Profile + first lesson, daily lessons,
  reflection → pattern + experiment diagnosis, book-to-life application, roadmap generation,
  journey tasks, the AI Coach chat, roleplay (both sides) and its scoring, and the weekly review
  synthesis — is a live call to `claude-opus-5` through a dedicated Cloud Function
  (`functions/src/handlers/*.ts`). Nothing is hardcoded or templated client-side.

## Architecture

```
app/ (static PWA, Firebase Hosting)
  index.html, css/style.css
  js/firebase.js   — SDK init + emulator auto-connect
  js/api.js        — typed wrappers over Firestore reads/writes + Cloud Function calls
  js/state.js      — client-side session cache (Firestore is the source of truth)
  js/screens.js    — every screen's render() + after() (event binding)
  js/app.js        — nav engine (go/back/tabs) + auth routing

functions/ (Cloud Functions, Node 20, TypeScript)
  src/admin.ts       — Firebase Admin bootstrap
  src/anthropic.ts   — Claude client + JSON/text helpers (claude-opus-5)
  src/util.ts        — auth guard, date helpers
  src/handlers/*.ts  — one file per product area (onboarding, daily mission, explore,
                       growth journeys, coach, roleplay, weekly review)

firestore.rules      — per-user data isolation
scripts/seedBooks.mjs — one-time public book catalog seed
```
