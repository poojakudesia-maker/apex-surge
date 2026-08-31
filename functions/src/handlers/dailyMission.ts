import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../admin.js";
import { askClaudeJSON } from "../anthropic.js";
import { requireAuth, todayId } from "../util.js";
import { anthropicKey } from "./onboarding.js";

interface DailyMissionResult {
  bookTitle: string;
  bookAuthor: string;
  lessonTitle: string;
  lessonBody: string[];
  quizQuestion: string;
  quizOptions: string[];
  quizCorrectIndex: number;
  quizExplain: string;
}

/**
 * Generates today's mission for a returning user (day 2+). Onboarding already
 * created day 1; this reuses the stored onboarding context plus recent
 * Playbook insights so lessons don't repeat and stay relevant to the user's
 * actual challenge and active journeys.
 */
export const generateDailyMission = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const userRef = db.collection("users").doc(uid);
    const missionId = todayId();

    const existing = await userRef.collection("missions").doc(missionId).get();
    if (existing.exists) {
      return { missionId, alreadyExists: true };
    }

    const [userSnap, insightsSnap, recentMissionsSnap, activeJourneysSnap] = await Promise.all([
      userRef.get(),
      userRef.collection("playbookInsights").orderBy("createdAt", "desc").limit(8).get(),
      userRef.collection("missions").orderBy("createdAt", "desc").limit(5).get(),
      userRef.collection("journeys").where("status", "==", "active").limit(3).get(),
    ]);
    if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
    const user = userSnap.data()!;
    const onboarding = user.onboarding ?? {};

    const recentTitles = recentMissionsSnap.docs.map((d) => d.data().lessonTitle).filter(Boolean);
    const insights = insightsSnap.docs.map((d) => d.data().text).join("; ");
    const journeyTitles = activeJourneysSnap.docs.map((d) => d.data().goalTitle).join(", ");

    const system = `You are the content engine for Apex Surge. You author one short, grounded
lesson per day, each based on a real, well-known non-fiction book, that builds on what the user
already knows and connects to their active journeys and challenge. Never repeat a lesson title
already used. Keep language warm, direct, and free of fluff.`;

    const userMsg = `User's original challenge: "${onboarding.challenge || "not specified"}"
Life areas: ${(onboarding.areas ?? []).join(", ") || "not specified"}
Daily time budget: ${onboarding.time ?? 10} minutes
Active journeys: ${journeyTitles || "none"}
Things already learned about this user: ${insights || "nothing yet"}
Lesson titles already used (do not repeat): ${recentTitles.join(", ") || "none"}

Produce a JSON object with this exact shape:
{
  "bookTitle": "a real, well-known non-fiction book title relevant to their challenge/journeys",
  "bookAuthor": "that book's real author",
  "lessonTitle": "a punchy 6-10 word lesson title, not reused",
  "lessonBody": ["paragraph 1 (2-3 sentences)", "paragraph 2 (2-3 sentences)", "paragraph 3 (2-3 sentences)"],
  "quizQuestion": "one comprehension question about the lesson's core idea",
  "quizOptions": ["option A", "option B", "option C"],
  "quizCorrectIndex": 0,
  "quizExplain": "one sentence explaining why the correct answer is correct"
}
The lesson must take about ${onboarding.time ?? 10} minutes to read.`;

    const result = await askClaudeJSON<DailyMissionResult>(system, userMsg, { effort: "high" });

    await userRef.collection("missions").doc(missionId).set({
      date: missionId,
      status: "pending",
      ...result,
      quizAnswer: null,
      reflection: null,
      pattern: null,
      experiment: null,
      durationMin: onboarding.time ?? 10,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { missionId, alreadyExists: false, ...result };
  }
);
