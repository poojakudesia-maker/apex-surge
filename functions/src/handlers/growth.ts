import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../admin.js";
import { askClaudeJSON } from "../anthropic.js";
import { requireAuth } from "../util.js";
import { anthropicKey } from "./onboarding.js";

interface Week {
  week: number;
  theme: string;
  focus: string;
}

interface RoadmapResult {
  weeks: Week[];
  focusAreas: string[];
  bookRefs: string[];
}

/** Self-assessment sliders -> AI-generated multi-week roadmap, persisted as a new journey. */
export const generateRoadmap = onCall({ secrets: [anthropicKey], cors: true }, async (request) => {
  const uid = requireAuth(request);
  const { goalTitle, goalDescription, weeks, assessment } = request.data as {
    goalTitle: string;
    goalDescription: string;
    weeks: number;
    assessment: { id: string; label: string; v: number }[];
  };
  if (!goalTitle) throw new HttpsError("invalid-argument", "goalTitle is required.");

  const system = `You are Apex Surge's Synthesis Engine. Design a multi-week transformation roadmap
that sequences weekly themes starting with the user's lowest self-assessed scores. Ground it in real,
well-known non-fiction books relevant to the goal. Each week must build on the last.`;

  const scoresText = assessment.map((a) => `${a.label}: ${a.v}/10`).join(", ");
  const userMsg = `Goal: "${goalTitle}" - ${goalDescription}
Self-assessment (1-10, lower = needs more work): ${scoresText}
Duration: ${weeks} weeks.

Respond with JSON exactly:
{
  "weeks": [ { "week": 1, "theme": "3-5 word theme", "focus": "one specific skill or practice for the week" }, ... exactly ${weeks} entries ],
  "focusAreas": ["3-5 short skill tags drawn from the lowest-scored assessment items"],
  "bookRefs": ["2-4 real, well-known non-fiction book titles this roadmap draws from"]
}`;

  const result = await askClaudeJSON<RoadmapResult>(system, userMsg, { effort: "high", maxTokens: 3000 });

  const ref = await db
    .collection("users")
    .doc(uid)
    .collection("journeys")
    .add({
      goalTitle,
      goalDescription,
      weeks: result.weeks.map((w) => ({ ...w, done: false })),
      focusAreas: result.focusAreas,
      bookRefs: result.bookRefs,
      assessment,
      currentWeek: 1,
      progressPct: 0,
      status: "active",
      createdAt: FieldValue.serverTimestamp(),
    });

  return { journeyId: ref.id, ...result };
});

interface JourneyTask {
  title: string;
  durationMin: number;
  bookRefs: string[];
}

/** Generates "today's mission" for an active journey, scoped to its current week's theme. */
export const generateJourneyTask = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { journeyId } = request.data as { journeyId: string };

    const journeyRef = db.collection("users").doc(uid).collection("journeys").doc(journeyId);
    const snap = await journeyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Journey not found.");
    const journey = snap.data()!;
    const week = journey.weeks[journey.currentWeek - 1];

    const system = `You are Apex Surge's Application Engine. Generate one small, concrete real-world
task (under 15 minutes) for today that practices this week's theme in a journey the user is on.`;
    const userMsg = `Journey: "${journey.goalTitle}". This week's theme: "${week.theme}" - focus: "${week.focus}".
Books this roadmap draws from: ${(journey.bookRefs ?? []).join(", ")}.

Respond with JSON exactly: { "title": "one imperative sentence, a concrete task", "durationMin": 8, "bookRefs": ["1-3 of the books listed above most relevant to this task"] }`;

    const task = await askClaudeJSON<JourneyTask>(system, userMsg, { effort: "medium" });
    return task;
  }
);

/** Advances the journey to the next week and recomputes progress. */
export const advanceJourneyWeek = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { journeyId } = request.data as { journeyId: string };
    const journeyRef = db.collection("users").doc(uid).collection("journeys").doc(journeyId);
    const snap = await journeyRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Journey not found.");
    const journey = snap.data()!;
    const weeks = journey.weeks as Week[];
    const nextWeek = Math.min(journey.currentWeek + 1, weeks.length);
    const updatedWeeks = weeks.map((w, i) => (i < journey.currentWeek ? { ...w, done: true } : w));
    const progressPct = Math.round((updatedWeeks.filter((w: any) => w.done).length / weeks.length) * 100);
    const status = nextWeek === journey.currentWeek && progressPct === 100 ? "complete" : "active";

    await journeyRef.update({ currentWeek: nextWeek, weeks: updatedWeeks, progressPct, status });
    return { currentWeek: nextWeek, progressPct, status };
  }
);
