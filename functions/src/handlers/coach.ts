import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "../admin.js";
import { askClaudeConversation } from "../anthropic.js";
import { requireAuth } from "../util.js";
import { anthropicKey } from "./onboarding.js";

/**
 * AI Coach: grounded in the user's own learning history (Playbook insights,
 * active journeys), not a generic chatbot. Persists the thread to Firestore.
 */
export const coachReply = onCall({ secrets: [anthropicKey], cors: true }, async (request) => {
  const uid = requireAuth(request);
  const { threadId, message } = request.data as { threadId: string | null; message: string };
  if (!message?.trim()) throw new HttpsError("invalid-argument", "message is required.");

  const userRef = db.collection("users").doc(uid);

  let realThreadId = threadId;
  const threadsCol = userRef.collection("coachThreads");
  if (!realThreadId) {
    const newThread = await threadsCol.add({ createdAt: FieldValue.serverTimestamp() });
    realThreadId = newThread.id;
  }
  const messagesCol = threadsCol.doc(realThreadId).collection("messages");

  const [insightsSnap, journeysSnap, historySnap] = await Promise.all([
    userRef.collection("playbookInsights").orderBy("createdAt", "desc").limit(6).get(),
    userRef.collection("journeys").where("status", "==", "active").limit(3).get(),
    messagesCol.orderBy("createdAt", "asc").limitToLast(10).get(),
  ]);

  const insights = insightsSnap.docs.map((d) => d.data().text).join("\n- ");
  const journeyTitles = journeysSnap.docs.map((d) => d.data().goalTitle).join(", ");

  const system = `You are the Apex Surge AI Coach. You are NOT a generic chatbot - you ground every
answer in what THIS user has already learned and is working on. Reference their active journeys and
past insights naturally where relevant, give concrete, actionable advice (not platitudes), and where
appropriate suggest a numbered "before you act" checklist. Keep replies under 180 words unless the
user asks for depth. If the situation is a conversation the user needs to have with someone, end by
offering to let them practice it via roleplay.

What we know about this user:
- Active journeys: ${journeyTitles || "none yet"}
- Things they've already learned about themselves:
- ${insights || "(nothing recorded yet)"}`;

  const history: Anthropic.MessageParam[] = historySnap.docs.map((d) => {
    const m = d.data();
    return { role: m.role === "user" ? "user" : "assistant", content: m.text };
  });
  history.push({ role: "user", content: message });

  const reply = await askClaudeConversation(system, history, { effort: "medium", maxTokens: 700 });

  const batch = db.batch();
  const userMsgRef = messagesCol.doc();
  const aiMsgRef = messagesCol.doc();
  batch.set(userMsgRef, { role: "user", text: message, createdAt: FieldValue.serverTimestamp() });
  batch.set(aiMsgRef, { role: "assistant", text: reply, createdAt: FieldValue.serverTimestamp() });
  await batch.commit();

  return { threadId: realThreadId, reply };
});
