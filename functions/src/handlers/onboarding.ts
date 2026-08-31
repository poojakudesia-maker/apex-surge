import { onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../admin.js";
import { askClaudeJSON } from "../anthropic.js";
import { requireAuth, todayId } from "../util.js";

export const anthropicKey = defineSecret("ANTHROPIC_API_KEY");

interface OnboardingInput {
  why: string;
  areas: string[];
  challenge: string;
  time: number;
  style: "text" | "audio" | "interactive";
}

interface FirstMission {
  bookTitle: string;
  bookAuthor: string;
  lessonTitle: string;
  lessonBody: string[];
  quizQuestion: string;
  quizOptions: string[];
  quizCorrectIndex: number;
  quizExplain: string;
}

interface GrowthProfileResult {
  summary: string;
  journeyTitle: string;
  firstMission: FirstMission;
}

/**
 * Called once, right after onboarding. Generates the user's Growth Profile
 * summary and their very first daily mission (real Claude-authored content,
 * grounded in what they told us), and persists both to Firestore.
 */
export const generateGrowthProfile = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const input = request.data as OnboardingInput;

    const system = `You are the content engine for Apex Surge, an app that turns ideas from
the world's best non-fiction books into personalized real-world experiments for the user's
actual life. You never recommend "read another book" as an end in itself - every idea becomes
a small, concrete action. Ground every lesson in a real, well-known non-fiction book and author
(behavioral science, habits, productivity, leadership, communication, confidence - whatever fits
the user's stated challenge). Keep language warm, direct, and free of fluff.`;

    const userMsg = `A new user just finished onboarding. Here is what they told us:
- Why they want to grow: "${input.why || "not specified"}"
- Life areas they chose to focus on: ${input.areas.join(", ") || "not specified"}
- Their biggest current challenge: "${input.challenge || "not specified"}"
- Daily time they can give: ${input.time} minutes
- Preferred learning style: ${input.style}

Produce a JSON object with this exact shape:
{
  "summary": "2-3 sentence warm, specific summary of what their Growth Profile is about, referencing their actual challenge",
  "journeyTitle": "a short 3-6 word title for their first 7-day journey, specific to their challenge",
  "firstMission": {
    "bookTitle": "a real, well-known non-fiction book title relevant to their challenge",
    "bookAuthor": "that book's real author",
    "lessonTitle": "a punchy 6-10 word lesson title",
    "lessonBody": ["paragraph 1 (2-3 sentences)", "paragraph 2 (2-3 sentences)", "paragraph 3 (2-3 sentences)"],
    "quizQuestion": "one comprehension question about the lesson's core idea",
    "quizOptions": ["option A", "option B", "option C"],
    "quizCorrectIndex": 0,
    "quizExplain": "one sentence explaining why the correct answer is correct"
  }
}
The lesson must take about ${input.time} minutes to read and connect directly to their stated challenge.`;

    const result = await askClaudeJSON<GrowthProfileResult>(system, userMsg, { effort: "high" });

    const userRef = db.collection("users").doc(uid);
    await userRef.set(
      {
        onboarding: { ...input, completedAt: FieldValue.serverTimestamp() },
        onboardingComplete: true,
        journeyTitle: result.journeyTitle,
        growthScore: 50,
        streak: 0,
        lastActiveDate: null,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const missionId = todayId();
    await userRef.collection("missions").doc(missionId).set({
      date: missionId,
      status: "pending",
      bookTitle: result.firstMission.bookTitle,
      bookAuthor: result.firstMission.bookAuthor,
      lessonTitle: result.firstMission.lessonTitle,
      lessonBody: result.firstMission.lessonBody,
      quizQuestion: result.firstMission.quizQuestion,
      quizOptions: result.firstMission.quizOptions,
      quizCorrectIndex: result.firstMission.quizCorrectIndex,
      quizExplain: result.firstMission.quizExplain,
      quizAnswer: null,
      reflection: null,
      pattern: null,
      experiment: null,
      durationMin: input.time,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { ...result, missionId };
  }
);
