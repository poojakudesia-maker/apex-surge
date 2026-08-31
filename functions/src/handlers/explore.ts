import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../admin.js";
import { askClaudeJSON } from "../anthropic.js";
import { requireAuth } from "../util.js";
import { anthropicKey } from "./onboarding.js";

interface ExperimentPlan {
  title: string;
  description: string;
  durationDays: number;
}

/** "Apply this to my life" from a book detail screen: area + behavior -> a scheduled experiment. */
export const applyBookToLife = onCall(
  { secrets: [anthropicKey], cors: true },
  async (request) => {
    const uid = requireAuth(request);
    const { bookTitle, bookAuthor, keyIdea, area, behavior } = request.data as {
      bookTitle: string;
      bookAuthor: string;
      keyIdea: string;
      area: string;
      behavior: string;
    };
    if (!behavior?.trim()) throw new HttpsError("invalid-argument", "behavior is required.");

    const system = `You are Apex Surge's Application Engine. Turn a book's key idea into ONE tiny,
concretely scheduled real-world experiment (2-5 days) that targets the specific behavior the user
named, in the specific life area they chose. Be concrete: name exact times, triggers, or checkpoints.`;

    const userMsg = `Book: "${bookTitle}" by ${bookAuthor}. Key idea: "${keyIdea}".
Life area: ${area}. Behavior the user wants to change: "${behavior}".

Respond with JSON exactly:
{ "title": "imperative one-sentence experiment tied to a concrete schedule", "description": "1 sentence, what to do and when", "durationDays": 3 }`;

    const plan = await askClaudeJSON<ExperimentPlan>(system, userMsg, { effort: "medium" });

    const ref = await db
      .collection("users")
      .doc(uid)
      .collection("experiments")
      .add({
        ...plan,
        area,
        behavior,
        source: `${bookTitle}`,
        days: new Array(plan.durationDays).fill(false),
        status: "active",
        streak: 0,
        createdAt: FieldValue.serverTimestamp(),
      });

    return { experimentId: ref.id, ...plan };
  }
);
