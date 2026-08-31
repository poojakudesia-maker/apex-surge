import { onCall } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../admin.js";
import { askClaudeJSON } from "../anthropic.js";
import { requireAuth, clampScore } from "../util.js";
import { anthropicKey } from "./onboarding.js";

interface ReviewResult {
  pattern: string;
  nextWeekPlan: string;
}

/** Weekly reflection -> AI-detected behavior pattern + an adapted plan for next week. */
export const synthesizeWeeklyReview = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { learnedTags, applied, failedReason } = request.data as {
      learnedTags: string[];
      applied: string;
      failedReason: string;
    };

    const userRef = db.collection("users").doc(uid);
    const [expSnap, missionsSnap] = await Promise.all([
      userRef.collection("experiments").where("status", "==", "active").get(),
      userRef.collection("missions").orderBy("createdAt", "desc").limit(7).get(),
    ]);
    const experimentSummaries = expSnap.docs
      .map((d) => `"${d.data().title}": ${(d.data().days ?? []).filter(Boolean).length}/${(d.data().days ?? []).length} days done`)
      .join("; ");

    const system = `You are Apex Surge's Adaptation Engine. Given a week of reflection, identify ONE
concrete behavioral pattern (not a platitude - reference specifics like time of day, context, or
triggers if the data suggests them) and propose one specific adjustment for next week's plan.`;
    const userMsg = `This week: learned about ${learnedTags.join(", ") || "various topics"}.
Applied: "${applied || "not specified"}". What didn't work and why: "${failedReason || "not specified"}".
Active experiments and completion so far: ${experimentSummaries || "none"}.

Respond with JSON exactly:
{ "pattern": "2 sentences, a specific observed behavioral pattern", "nextWeekPlan": "2 sentences, one specific adjustment for next week" }`;

    const result = await askClaudeJSON<ReviewResult>(system, userMsg, { effort: "medium" });

    await userRef.collection("weeklyReviews").add({
      learnedTags,
      applied,
      failedReason,
      ...result,
      createdAt: FieldValue.serverTimestamp(),
    });

    const userSnap = await userRef.get();
    const growthScore = clampScore((userSnap.data()?.growthScore ?? 50) + 2);
    await userRef.update({ growthScore });

    return { ...result, growthScore };
  }
);
