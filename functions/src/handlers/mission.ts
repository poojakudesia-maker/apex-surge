import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../admin.js";
import { askClaudeJSON, askClaudeText } from "../anthropic.js";
import { requireAuth, clampScore } from "../util.js";
import { anthropicKey } from "./onboarding.js";

interface Pattern {
  trigger: string;
  behavior: string;
  underlyingIssue: string;
  relatedBooks: string[];
}

interface ExperimentPlan {
  title: string;
  description: string;
  durationDays: number;
  timeOfDay: string;
}

interface DiagnoseResult {
  pattern: Pattern;
  experiment: ExperimentPlan;
}

/**
 * "Apply this to you" step: takes the user's free-text reflection on today's
 * lesson and turns it into (1) an AI-diagnosed behavior pattern and (2) a
 * concrete, dated real-world experiment. This is the core "aha moment" of
 * the product - content becomes action.
 */
export const diagnoseReflection = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { missionId, reflectionText } = request.data as {
      missionId: string;
      reflectionText: string;
    };
    if (!missionId || !reflectionText?.trim()) {
      throw new HttpsError("invalid-argument", "missionId and reflectionText are required.");
    }

    const missionRef = db.collection("users").doc(uid).collection("missions").doc(missionId);
    const missionSnap = await missionRef.get();
    if (!missionSnap.exists) throw new HttpsError("not-found", "Mission not found.");
    const mission = missionSnap.data()!;

    const system = `You are Apex Surge's Application Engine. Given a lesson the user just learned
and their own words about a real struggle, you (1) name their behavior pattern in blunt, specific,
non-judgmental language, and (2) design ONE tiny, concretely scheduled real-world experiment that
applies the lesson to that exact struggle. Experiments must be small enough to be almost impossible
to refuse (a specific action, a specific trigger/time, under 15 minutes), and run 3-7 days.`;

    const userMsg = `Today's lesson: "${mission.lessonTitle}" from "${mission.bookTitle}" by ${mission.bookAuthor}.
Lesson content: ${(mission.lessonBody as string[]).join(" ")}

The user's reflection on what they're struggling with right now: "${reflectionText}"

Respond with JSON exactly matching:
{
  "pattern": {
    "trigger": "short phrase - what sets the behavior off",
    "behavior": "short phrase - what they actually do",
    "underlyingIssue": "short phrase - the real root cause",
    "relatedBooks": ["book title 1", "book title 2", "book title 3"]
  },
  "experiment": {
    "title": "one sentence, imperative, very concrete action tied to a specific time/trigger",
    "description": "1 sentence describing exactly what to do and when",
    "durationDays": 3,
    "timeOfDay": "e.g. 'Tomorrow at 9:30 AM' or 'Right after you brush your teeth tonight'"
  }
}`;

    const result = await askClaudeJSON<DiagnoseResult>(system, userMsg, { effort: "high" });
    const days = new Array(result.experiment.durationDays).fill(false);

    await missionRef.update({
      reflection: reflectionText,
      pattern: result.pattern,
      experiment: { ...result.experiment, days, status: "active", adaptedStrategy: null },
      status: "reflected",
    });

    return result;
  }
);

/** Marks a given day of the active experiment done/undone and updates streak + growth score. */
export const markExperimentDay = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { missionId, dayIndex, done } = request.data as {
      missionId: string;
      dayIndex: number;
      done: boolean;
    };

    const userRef = db.collection("users").doc(uid);
    const missionRef = userRef.collection("missions").doc(missionId);
    const missionSnap = await missionRef.get();
    if (!missionSnap.exists) throw new HttpsError("not-found", "Mission not found.");
    const mission = missionSnap.data()!;
    const days: boolean[] = mission.experiment?.days ?? [];
    days[dayIndex] = done;

    await missionRef.update({ "experiment.days": days });

    if (done) {
      const userSnap = await userRef.get();
      const growthScore = clampScore((userSnap.data()?.growthScore ?? 50) + 1);
      await userRef.update({ growthScore });
    }

    return { days };
  }
);

/** When the user missed a day, ask Claude to adapt the strategy based on the stated reason. */
export const adaptExperiment = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { missionId, missedReason } = request.data as {
      missionId: string;
      missedReason: string;
    };

    const missionRef = db.collection("users").doc(uid).collection("missions").doc(missionId);
    const missionSnap = await missionRef.get();
    if (!missionSnap.exists) throw new HttpsError("not-found", "Mission not found.");
    const mission = missionSnap.data()!;

    const system = `You are Apex Surge's Behavior Engine. The user ran a small experiment and missed
a day. Given why, identify the real cause in one sentence and propose one concrete adjustment to the
experiment (a new time, trigger, or format) that removes that specific obstacle. Be specific and brief.`;
    const userMsg = `Experiment: "${mission.experiment?.title}". They missed a day because: "${missedReason}".
Respond with plain text, max 2 sentences: first the diagnosis, then the adjusted strategy.`;

    const adaptedStrategy = await askClaudeText(system, userMsg, { effort: "medium", maxTokens: 300 });
    await missionRef.update({ "experiment.adaptedStrategy": adaptedStrategy });
    return { adaptedStrategy };
  }
);

/** Marks the mission fully complete and bumps growth score + streak. */
export const completeMission = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { missionId } = request.data as { missionId: string };

    const userRef = db.collection("users").doc(uid);
    const missionRef = userRef.collection("missions").doc(missionId);
    await missionRef.update({ status: "complete" });

    const today = new Date().toISOString().slice(0, 10);
    const userSnap = await userRef.get();
    const u = userSnap.data() ?? {};
    const lastActive: string | null = u.lastActiveDate ?? null;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = lastActive === yesterday || lastActive === today ? (u.streak ?? 0) + 1 : 1;
    const growthScore = clampScore((u.growthScore ?? 50) + 3);

    await userRef.update({ streak: newStreak, growthScore, lastActiveDate: today });

    // Fold key learnings into the user's Playbook so it accumulates over time.
    const missionSnap = await missionRef.get();
    const mission = missionSnap.data()!;
    if (mission.pattern) {
      await userRef.collection("playbookInsights").add({
        book: mission.bookTitle,
        text: `${mission.pattern.underlyingIssue} (from: "${mission.lessonTitle}")`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return { streak: newStreak, growthScore };
  }
);
