# Synthetic User & Usability Simulator: Build Plan

Working name: **Walkthrough**. A web app where a designer describes a flow (text, screenshots, or later a Figma link), picks one or more target personas, and gets back a step-by-step simulated walkthrough per persona, with cognitive-load scores, likely drop-off points, mental-model mismatches, and a ready-to-run test protocol for real usability sessions.

The outputs are hypotheses to test with real people. The product should say so on every report, and the whole design below is built around making those hypotheses specific and evidence-backed enough to be worth testing.

---

## 1. The core design decision: the persona can't see the whole flow

Most "AI usability review" tools hand the model the full flow and ask "where would a novice struggle?". The model then answers with hindsight: it knows the Save button is on screen 4, so it never gets lost looking for it. That produces generic heuristic reviews, not simulations.

Walkthrough splits the work into agents with different information:

| Agent | Sees | Produces |
|---|---|---|
| Flow Parser | Designer's raw input (text, images) | A structured flow graph: screens, elements, transitions, the user goal |
| Persona Builder | Persona parameters | A behavioral persona profile (what they know, expect, tolerate) |
| Simulator (persona agent) | Persona profile + goal + **only the current screen** | A think-aloud trace of actions, hesitations, errors, and an optional abandon |
| Analyst | Full flow graph + all traces | Per-step cognitive-load scores, issues with evidence, drop-off estimates |
| Protocol Writer | Analyst report + flow | Test script, tasks, success criteria, screener, probe questions |

The app, not the model, owns the flow state machine. When the persona agent clicks something, your code looks up the transition and returns the next screen. If the persona clicks something that doesn't exist or leads nowhere, that's a finding. This is what makes the walkthrough a simulation rather than a review.

---

## 2. User-facing features

### MVP (what ships first)

1. **Project and flow input.** Paste a free-text flow description ("Screen 1: Login with email/password and a 'Continue with Google' button...") or upload 1–15 screenshots in order. The Flow Parser turns it into a structured graph, which the designer reviews and corrects in an editor before running anything. Correction matters: garbage in the graph means garbage walkthroughs.
2. **Persona library.** Presets ("Non-tech-savvy retiree", "Domain expert power user", "Time-pressed manager on mobile", "First-time visitor, skeptical", "Screen-reader user") plus a custom builder with sliders and fields (see section 4).
3. **Run a simulation.** Pick a flow + 1–4 personas + runs per persona (default 3). Runs execute in the background; the UI streams each persona's think-aloud live.
4. **Report.**
   - Journey chart: cognitive load (0–10) per step, one line per persona.
   - Drop-off funnel: % of runs that abandoned at each step, per persona.
   - Issues list: each issue tied to a step, a screen element, a quoted piece of the persona's reasoning, a severity (1–4, Nielsen scale), a heuristic tag, and a suggested fix.
   - Mental-model mismatches: "Persona expected X, design does Y."
5. **Test protocol export.** Tasks, success criteria, time limits, pre-/post-task questions, which issues each task is meant to confirm, and a recruiting screener. Export as Markdown and PDF.

### Phase 2

- Version comparison: run the same personas against Flow v1 and v2, show deltas in load and drop-off.
- Figma import (via the Figma REST API: frames become screens, prototype connections become transitions).
- Shared workspaces, comments on issues, "confirmed / rejected in real testing" tags.
- Calibration dashboard (section 9).

---

## 3. Tech stack

A recommendation, chosen for long-running AI jobs and relational data:

| Layer | Choice | Why |
|---|---|---|
| Frontend + API | Next.js 15 (App Router, TypeScript) | One repo for UI and server routes; server-side Claude calls |
| UI | Tailwind + shadcn/ui, React Flow for the flow editor, Recharts for charts | React Flow gives you a draggable screen graph for free |
| Database | Postgres via Supabase | Relational fits projects → flows → runs → steps → issues; Supabase also gives auth and file storage |
| Auth | Supabase Auth (Google + email magic link) | |
| File storage | Supabase Storage | Screenshots, exported PDFs |
| Background jobs | Inngest (or Trigger.dev) | A simulation is 1–5 minutes of chained Claude calls; this can't live in a request handler. Inngest gives retries, step-level checkpoints, and fan-out per persona/run |
| Live updates | Supabase Realtime on the `run_steps` table | UI subscribes; each step the worker writes appears live |
| AI | Claude API via `@anthropic-ai/sdk`, server-side only | |
| PDF export | `@react-pdf/renderer` | |
| Hosting | Vercel (app) + Supabase cloud + Inngest cloud | |
| Validation | Zod everywhere (API inputs, Claude structured outputs) | |

If you'd rather stay on Firebase like the existing APEX SURGE app, it works: Firestore + Cloud Functions 2nd gen (60-min timeout) + Cloud Tasks for fan-out. You lose SQL for the analytics in the report, which is why I'd pick Postgres.

One security note carried over from APEX SURGE: `src/services/claudeAPI.js` there reads `REACT_APP_CLAUDE_API_KEY` in the browser. Create React App bundles every `REACT_APP_` variable into the public JS, so that key is readable by anyone who opens the app. In this project every Claude call happens on the server; the key never ships to the client.

---

## 4. Data model

```
users(id, email, name, created_at)
workspaces(id, name, owner_id)
workspace_members(workspace_id, user_id, role)

projects(id, workspace_id, name, description, created_at)

flows(id, project_id, version, name, source_type['text'|'images'|'figma'],
      raw_input text, graph jsonb, goal text, status['draft'|'confirmed'], created_at)
flow_assets(id, flow_id, storage_path, order_index, screen_id)

personas(id, workspace_id nullable, is_preset bool, name, params jsonb, profile jsonb)

simulations(id, flow_id, created_by, status['queued'|'running'|'analyzing'|'done'|'failed'],
            config jsonb, cost_usd numeric, started_at, finished_at)
runs(id, simulation_id, persona_id, run_index, outcome['completed'|'abandoned'|'stuck'|'error'],
     abandoned_at_step int, total_steps int, trace_summary text)
run_steps(id, run_id, step_index, screen_id, observation text, thought text,
          action jsonb, confidence int, felt_load int, emotion text, created_at)

issues(id, simulation_id, screen_id, element_id, title, description, severity int,
       heuristic text, category['cognitive_load'|'drop_off'|'mental_model'|'findability'|'terminology'|'accessibility'|'trust'],
       evidence jsonb, affected_personas text[], suggested_fix text,
       validation_status['unvalidated'|'confirmed'|'rejected'])
step_metrics(simulation_id, persona_id, screen_id, load_score numeric, dropoff_rate numeric,
             load_breakdown jsonb)

protocols(id, simulation_id, content jsonb, markdown text, created_at)
```

### Flow graph (the `flows.graph` JSON)

```json
{
  "goal": "Book a 30-minute consultation for next Tuesday",
  "entry_screen": "s1",
  "screens": [
    {
      "id": "s1",
      "name": "Home",
      "description": "Landing page with hero banner and top nav",
      "elements": [
        { "id": "e1", "type": "button", "label": "Get started", "prominence": "high", "location": "hero center" },
        { "id": "e2", "type": "link", "label": "Services", "prominence": "medium", "location": "top nav" }
      ],
      "text_content": ["Your health, simplified", "Trusted by 10,000 patients"]
    }
  ],
  "transitions": [
    { "from": "s1", "element": "e1", "action": "click", "to": "s2" },
    { "from": "s1", "element": "e2", "action": "click", "to": "s5" }
  ],
  "success_screens": ["s9"]
}
```

Elements with no outgoing transition are dead ends. Clicking them is logged as "no response", which is a real signal (a designer forgot a path, or a label misleads).

### Persona parameters (`personas.params`)

Avoid demographic caricatures ("65-year-old woman who hates computers"). Parameterize behavior instead; the Persona Builder turns these into a narrative profile.

| Parameter | Range / type |
|---|---|
| Digital literacy | 1–5 |
| Domain expertise | 1–5 |
| Time pressure | 1–5 |
| Motivation to finish | 1–5 |
| Patience / frustration tolerance | 1–5 |
| Device & context | desktop / mobile / tablet; quiet / distracted |
| Reading behavior | reads everything / skims / scans for keywords |
| Prior products used | free text ("uses WhatsApp and online banking, never used Notion") |
| Accessibility needs | none / low vision / screen reader / motor / cognitive |
| Language | primary language, proficiency in UI language |
| Goal framing | how they'd phrase the task in their own words |

---

## 5. Agent pipeline in detail

```
Designer input
   │
   ▼
[1] Flow Parser ──► flow graph (designer confirms/edits)
   │
[2] Persona Builder ──► persona profile (cached per persona)
   │
   ▼
[3] Simulator × (personas × runs)   ◄── fan-out, parallel jobs
   │     loop: observe screen → think → act → app returns next screen
   │     ends on: success screen | abandon | step cap | stuck
   ▼
[4] Analyst ──► per-step load scores, issues, drop-off, mismatches
   │
[5] Protocol Writer ──► test protocol
   ▼
Report
```

### [1] Flow Parser

One Claude call with structured output (`client.messages.parse` + `zodOutputFormat(FlowGraphSchema)`). For screenshots, send each image as an image content block in order; Claude reads layout, labels, and visual prominence. The prompt asks it to mark anything it inferred rather than saw (`"inferred": true`) so the editor can highlight those for the designer to check.

### [2] Persona Builder

One structured-output call that turns parameters into a profile: vocabulary they understand and don't, UI conventions they recognize (hamburger menu, swipe, breadcrumbs), what they'd do when stuck (go back, search, call someone, quit), what makes them distrust a page, and a threshold for giving up. Store it; reuse it across simulations.

### [3] Simulator (the agentic part)

A tool-use loop. The persona agent gets the persona profile, the goal in the persona's own words, and the current screen rendered as text (plus the screenshot if the flow came from images). It never gets the full graph.

Tools (all `strict: true`):

| Tool | Input | What your code does |
|---|---|---|
| `interact` | `element_id`, `action` (click/type/scroll/hover/back), `value?`, `why` | Looks up the transition; returns the next screen, or "nothing happened" |
| `look_closer` | `region` or `element_id` | Returns detail for that element (helper text, tooltip) if the design has it; costs a step |
| `note_state` | `felt_load` 0–10, `confidence` 0–10, `emotion`, `confusions[]`, `expectation` (what they think will happen next) | Writes a `run_steps` row |
| `give_up` | `reason`, `what_they_would_do_instead` | Ends the run as abandoned |

The system prompt makes the agent call `note_state` before every `interact`, stay in character (a digital-literacy-1 persona does not know what a kebab menu is), think aloud in first person, and prefer realistic behavior over efficient behavior. Opus 5.5 doesn't accept forced `tool_choice`, so this is enforced by prompt plus a check in your loop: if a turn has `interact` without a preceding `note_state`, send a short correction.

Stop conditions enforced in code, not by the model: reached a success screen, `give_up`, step cap (e.g. 3× the shortest path length), or the same screen visited 4 times (stuck).

Run each persona 3–5 times. A single run is an anecdote; with 5 you can say "abandoned at the payment screen in 3 of 5 runs", which is the number designers actually want.

### [4] Analyst

Sees everything: the graph, the persona profiles, and all traces. Produces, with structured output:

- Per screen per persona, a cognitive-load score built from countable things so it isn't just a vibe: number of decisions, number of unfamiliar terms (against the persona's vocabulary), items the user must hold in memory across screens, visual competition (count of high-prominence elements), and the persona's self-reported `felt_load`. Show the breakdown in the UI so a designer can see *why* step 4 scored 8.
- Issues, each required to cite evidence: the run IDs and step indexes, a quoted thought, the element. An issue without evidence gets dropped in post-processing. This is the main defense against the model inventing problems.
- Drop-off rate per step, computed in code from run outcomes (don't ask the model to do arithmetic you can do in SQL).
- Mental-model mismatches from comparing each step's `expectation` with what actually happened next. Mismatches are computed mostly in code: expectation vs. actual next screen, then the Analyst explains them.

### [5] Protocol Writer

Structured output: 3–6 tasks phrased the way real users would receive them (no UI words in the task text), success criteria, time limits, which issue each task is designed to confirm or rule out, probe questions for the moderator at the predicted friction points, post-task SEQ question, and a screener matching the personas that struggled most.

---

## 6. Claude API setup

Default model: `claude-opus-5-5` for every agent. Things to know about it and how this app uses them:

- **Thinking is always on** for Opus 5.5 and can't be disabled; control depth with `output_config.effort`. Default is `medium`. Suggested starting points: Flow Parser `high`, Persona Builder `medium`, Simulator `medium`, Analyst `high`, Protocol Writer `medium`. Measure before raising anything.
- **No forced tool choice.** Use `tool_choice: auto`, `strict: true` on tools, and prompt instructions (as in section 5). Use structured outputs for single-shot JSON.
- **Structured outputs** via `client.messages.parse()` with Zod schemas for agents 1, 2, 4, 5.
- **Prompt caching.** The flow graph + persona profile + system prompt are identical across all runs of a persona. Put them first with a `cache_control` breakpoint; only the growing conversation varies. With 3–5 runs per persona this is the single biggest cost saving.
- **Refusal handling.** Check `stop_reason === "refusal"` before reading content, and enable server-side fallbacks (`fallbacks: "default"` with the `server-side-fallback-2026-07-01` beta header). Usability flows for health or finance apps can occasionally trip classifiers.
- **Streaming** for the Analyst and Protocol Writer (long outputs). Use `.finalMessage()`.
- **Vision** for screenshot flows: images in the Flow Parser and in each Simulator turn.
- **Batch API (50% off)** for a "run overnight, 20 runs per persona" mode later.

A cheaper model for bulk simulator runs (Sonnet 5.5 at $2/$10 per million tokens vs. Opus 5.5 at $4/$20) is a cost lever to test once you have an eval (section 9), not something to assume up front.

### Simulator loop sketch (TypeScript, runs inside an Inngest step)

```ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // ANTHROPIC_API_KEY from server env

export async function simulateRun(flow: FlowGraph, persona: PersonaProfile, runIndex: number) {
  const system = [
    { type: "text", text: SIMULATOR_INSTRUCTIONS },
    { type: "text", text: renderPersona(persona), cache_control: { type: "ephemeral" } },
  ];

  let screenId = flow.entry_screen;
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: [
        { type: "text", text: `Your goal: ${persona.goal_in_own_words}\n\nYou are looking at:\n${renderScreen(flow, screenId)}` },
    ]},
  ];

  const visits = new Map<string, number>();
  for (let step = 0; step < maxSteps(flow); step++) {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system,
      tools: SIMULATOR_TOOLS, // interact, look_closer, note_state, give_up; all strict: true
      messages,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    });

    if (response.stop_reason === "refusal") return finishRun("error");
    messages.push({ role: "assistant", content: response.content });

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    if (toolUses.length === 0) { /* nudge: "Decide your next action." */ continue; }

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of toolUses) {
      switch (call.name) {
        case "note_state":
          await saveStep(runIndex, step, screenId, call.input);
          results.push({ type: "tool_result", tool_use_id: call.id, content: "noted" });
          break;
        case "interact": {
          const next = resolveTransition(flow, screenId, call.input);
          if (!next) {
            results.push({ type: "tool_result", tool_use_id: call.id, content: "Nothing visibly happened." });
          } else {
            screenId = next;
            visits.set(screenId, (visits.get(screenId) ?? 0) + 1);
            results.push({ type: "tool_result", tool_use_id: call.id, content: renderScreen(flow, screenId) });
          }
          break;
        }
        case "look_closer":
          results.push({ type: "tool_result", tool_use_id: call.id, content: renderDetail(flow, screenId, call.input) });
          break;
        case "give_up":
          return finishRun("abandoned", step, call.input);
      }
    }
    messages.push({ role: "user", content: results }); // all results in one message

    if (flow.success_screens.includes(screenId)) return finishRun("completed", step);
    if ((visits.get(screenId) ?? 0) >= 4) return finishRun("stuck", step);
  }
  return finishRun("stuck");
}
```

Treat this as a shape, not final code: validate each tool input with Zod before acting on it, and write every step to Postgres as it happens so the live view updates.

---

## 7. Screens and UX

1. **Dashboard.** Projects, recent simulations, credits/cost used.
2. **Flow input.** Tabs for "Describe", "Upload screenshots", "Import from Figma" (phase 2). A sample flow button so first-time users see results in two minutes.
3. **Flow editor.** React Flow canvas: screens as nodes, transitions as edges. Side panel to edit elements. Inferred items highlighted yellow. Warnings for dead ends and unreachable screens. "Confirm flow" gates the Run button.
4. **Persona picker.** Preset cards + "Custom". Custom builder shows the sliders and a live preview of the generated profile.
5. **Run config.** Personas, runs per persona, cost estimate before starting.
6. **Live run.** One column per persona, think-aloud streaming in like a chat, a mini-map of the flow highlighting where each persona currently is. Designers will watch this; it's the moment that sells the product.
7. **Report.** Summary strip (completion rate per persona, worst step, top 3 issues), journey load chart, drop-off funnel, issues table with filters (persona, severity, category), click an issue to jump to the trace moment. Mental-model mismatches as a separate section.
8. **Compare.** Two simulations side by side (v1 vs v2, or persona A vs B).
9. **Protocol.** Editable document view, export Markdown/PDF, copy to clipboard.

---

## 8. Build phases

| Phase | Weeks | Deliverable | Exit test |
|---|---|---|---|
| 0. Prompt prototype | 1 | Node script: text flow in, 3 personas × 3 runs, JSON report out. No UI | On 3 flows with known problems, it finds most of them and the traces read like real users |
| 1. MVP skeleton | 2–3 | Next.js app, Supabase auth + schema, text flow input, Flow Parser, flow editor (basic form, not canvas yet), preset personas | A designer can create a flow and confirm the graph |
| 2. Simulation engine | 4–5 | Inngest jobs, Simulator loop, live run view via Realtime, cost tracking | 4 personas × 3 runs finish in under 5 minutes with no stuck jobs |
| 3. Analysis + report | 6–7 | Analyst, metrics in SQL, charts, issues table, Protocol Writer, Markdown/PDF export | Report useful enough that 3 designers you know would use it before a real test |
| 4. Images + custom personas | 8–9 | Screenshot upload with vision, React Flow canvas editor, custom persona builder | Screenshot flows parse accurately enough that edits take under 5 min |
| 5. Compare + calibration | 10–12 | Version compare, issue validation tags, calibration dashboard, workspaces | Designers log real-test outcomes against predictions |
| 6. Figma + billing | 13+ | Figma import, Stripe usage-based billing | |

Phase 0 matters most. If the traces from a plain script don't impress a designer, no UI will fix that.

---

## 9. Evaluation and calibration

You need to know whether the simulator is right, not just whether it sounds convincing.

**Seeded-flaw test set.** Write 15–20 flows with known, planted issues: a primary CTA styled as a text link, jargon on a key button ("Provision workspace"), a 14-field form on mobile, a required field only flagged after submit, a back button that loses form data, a success screen that doesn't confirm success. Also include 3–4 clean flows with no planted issues. Track:

- Recall: % of planted issues found.
- False-alarm rate: issues reported on clean flows, or unsupported issues on seeded ones.
- Persona sensitivity: does the expert persona sail through the jargon flow while the novice stalls? If every persona hits the same problems, the personas aren't doing anything.
- Run-to-run consistency: same flow, same persona, 5 runs. Similar outcomes, not identical ones.

Run this suite on every prompt change (a GitHub Action that posts scores on the PR).

**Real-world calibration (phase 5).** After a designer runs real sessions, they mark each predicted issue confirmed or rejected and add issues the simulation missed. Over time this gives you precision and recall on real data, per persona type, and a dataset for improving prompts. Show it in the product: "In your workspace, 68% of severity-3+ predictions were confirmed in real testing." That number is what earns trust.

---

## 10. Cost estimate (per simulation)

Rough numbers at Opus 5.5 pricing ($4 input / $20 output per million tokens), 10-step flow:

| Item | Calls | Approx. cost |
|---|---|---|
| Flow Parser | 1 | $0.05–0.15 (more with screenshots) |
| Persona Builder | 0–4 (cached after first use) | $0.02 each |
| Simulator run | ~12 turns, growing context, flow + persona cached | $0.20–0.45 |
| Analyst | 1 | $0.20–0.40 |
| Protocol Writer | 1 | $0.05–0.10 |

4 personas × 3 runs ≈ **$3–6 per simulation**. Compare that with $100–200 per participant for a moderated test session. Price plans per simulation (e.g. 20 simulations/month on a $49 plan) and track actual `usage` from every response in the `simulations.cost_usd` column from day one, so the estimate gets replaced by real numbers fast.

---

## 11. Risks and how the design handles them

| Risk | Mitigation |
|---|---|
| Model knows too much and "solves" the flow like an expert | Information hiding: persona only sees the current screen; app owns navigation |
| Reports list problems everywhere (models like finding issues) | Evidence required per issue; clean flows in the eval; severity rubric in the prompt; an explicit "no significant issues" outcome is allowed |
| Personas turn into stereotypes | Behavioral parameters, not demographics; profiles are editable and visible |
| Designers treat output as real research | Every report labeled "predicted, validate with real users"; protocol output points them to real testing |
| Text descriptions are too vague to simulate | Flow Parser flags ambiguity, editor forces confirmation, warnings for dead ends |
| Long jobs fail midway | Inngest step checkpoints; each run is its own step, retried independently |
| Uploaded designs are confidential | Server-side processing only, per-workspace access rules in Supabase RLS, deletion on request, state data handling clearly in the privacy page |

---

## 12. Repo layout

```
walkthrough/
├── app/
│   ├── (auth)/login/
│   ├── dashboard/
│   ├── projects/[id]/
│   ├── flows/[id]/edit/
│   ├── simulations/[id]/          # live run + report
│   ├── simulations/[id]/protocol/
│   └── api/
│       ├── flows/parse/route.ts
│       ├── simulations/route.ts   # creates simulation, sends Inngest event
│       └── inngest/route.ts
├── lib/
│   ├── agents/
│   │   ├── flow-parser.ts
│   │   ├── persona-builder.ts
│   │   ├── simulator.ts
│   │   ├── analyst.ts
│   │   └── protocol-writer.ts
│   ├── prompts/                   # versioned prompt files
│   ├── schemas/                   # Zod: FlowGraph, PersonaProfile, Issue, Protocol
│   ├── flow-engine.ts             # renderScreen, resolveTransition, graph validation
│   ├── metrics.ts                 # load score composition, drop-off math
│   └── supabase/
├── inngest/
│   └── simulate.ts                # fan-out: persona × run → analyst → protocol
├── components/
│   ├── flow-editor/
│   ├── live-run/
│   └── report/
├── evals/
│   ├── flows/                     # seeded-flaw flows + expected issues
│   └── run-evals.ts
└── supabase/migrations/
```

---

## 13. First week, concretely

1. Write 3 flows as text: one you know is good, two with known issues (use real products you've tested, if you have findings from past studies).
2. Write the Simulator prompt and the four tools; build `flow-engine.ts` and the loop as a plain Node script.
3. Run 3 personas × 3 runs on each flow. Read every trace.
4. Write the Analyst prompt; compare its issues with what you know is true.
5. Show the output to two designers. Ask: "Would you change your test plan based on this?" If yes, start phase 1.
