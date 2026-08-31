import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import type Anthropic from "@anthropic-ai/sdk";
import { db } from "../admin.js";
import { askClaudeConversation, askClaudeJSON } from "../anthropic.js";
import { requireAuth } from "../util.js";
import { anthropicKey } from "./onboarding.js";

const PERSONAS: Record<string, string> = {
  manager: `You are playing the role of the user's direct manager in a roleplay practice session.
Be realistic: professional, a little busy, not hostile but not a pushover - push back mildly and ask
follow-up questions before conceding anything. Stay fully in character, 2-4 sentences per reply.`,
  report: `You are playing the role of the user's direct report receiving feedback in a roleplay
practice session. React like a real person would: a little defensive at first, then open up if the
user is clear and kind. Stay fully in character, 2-4 sentences per reply.`,
  client: `You are playing the role of a difficult client in a roleplay practice session. Push for
more than is reasonable, but respond like a real person to a well-held boundary. Stay fully in
character, 2-4 sentences per reply.`,
};

interface Turn {
  role: "user" | "assistant";
  text: string;
}

export const roleplayReply = onCall({ secrets: [anthropicKey], cors: true }, async (request) => {
  const uid = requireAuth(request);
  const { roleplayId, scenario, message } = request.data as {
    roleplayId: string | null;
    scenario: string;
    message: string;
  };
  if (!message?.trim()) throw new HttpsError("invalid-argument", "message is required.");
  const persona = PERSONAS[scenario] ?? PERSONAS.manager;

  const col = db.collection("users").doc(uid).collection("roleplays");
  let ref = roleplayId ? col.doc(roleplayId) : col.doc();
  let transcript: Turn[] = [];
  if (roleplayId) {
    const snap = await ref.get();
    if (snap.exists) transcript = snap.data()!.transcript ?? [];
  } else {
    await ref.set({ scenario, transcript: [], feedback: null, createdAt: FieldValue.serverTimestamp() });
  }

  transcript.push({ role: "user", text: message });
  const history: Anthropic.MessageParam[] = transcript.map((t) => ({ role: t.role, content: t.text }));
  const reply = await askClaudeConversation(persona, history, { effort: "medium", maxTokens: 300 });
  transcript.push({ role: "assistant", text: reply });

  await ref.update({ transcript });
  return { roleplayId: ref.id, reply };
});

interface Feedback {
  clarity: number;
  confidence: number;
  evidence: number;
  assertiveness: number;
  note: string;
}

export const roleplayFeedback = onCall({ secrets: [anthropicKey], cors: true }, async (request) => {
  const uid = requireAuth(request);
  const { roleplayId } = request.data as { roleplayId: string };
  const ref = db.collection("users").doc(uid).collection("roleplays").doc(roleplayId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Roleplay not found.");
  const transcript: Turn[] = snap.data()!.transcript ?? [];

  const system = `You are a communication coach scoring a practice roleplay conversation. Score the
USER's turns only (not the AI persona's) on a 1-10 scale for each dimension. Be honest but
encouraging, and the "note" should name ONE specific, actionable thing to improve.`;
  const transcriptText = transcript
    .map((t) => `${t.role === "user" ? "User" : "Other person"}: ${t.text}`)
    .join("\n");
  const userMsg = `Transcript:\n${transcriptText}\n\nRespond with JSON exactly:
{ "clarity": 8, "confidence": 6, "evidence": 9, "assertiveness": 5, "note": "one sentence, specific and actionable" }`;

  const feedback = await askClaudeJSON<Feedback>(system, userMsg, { effort: "medium" });
  await ref.update({ feedback });
  return feedback;
});
