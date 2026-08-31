import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    // ANTHROPIC_API_KEY is injected at runtime via the bound Firebase secret
    // (see secrets: [anthropicKey] on each onCall function).
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

type Effort = "low" | "medium" | "high";

/** Plain-text completion. Used for conversational replies (coach, roleplay). */
export async function askClaudeText(
  system: string,
  userMessage: string,
  opts: { effort?: Effort; maxTokens?: number } = {}
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1200,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.effort ?? "medium" },
    messages: [{ role: "user", content: userMessage }],
  });
  return extractText(response);
}

/** Multi-turn text completion (coach chat, roleplay). History excludes the system prompt. */
export async function askClaudeConversation(
  system: string,
  history: Anthropic.MessageParam[],
  opts: { effort?: Effort; maxTokens?: number } = {}
): Promise<string> {
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 1200,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.effort ?? "medium" },
    messages: history,
  });
  return extractText(response);
}

/**
 * Completion that must return JSON matching a shape the caller expects.
 * We instruct Claude to emit ONLY JSON, then parse defensively (Claude
 * occasionally wraps JSON in a markdown fence despite instructions).
 */
export async function askClaudeJSON<T>(
  system: string,
  userMessage: string,
  opts: { effort?: Effort; maxTokens?: number } = {}
): Promise<T> {
  const jsonSystem = `${system}\n\nRespond with ONLY a single valid JSON object or array. No markdown fences, no commentary, no text before or after the JSON.`;
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 2000,
    system: [{ type: "text", text: jsonSystem, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.effort ?? "high" },
    messages: [{ role: "user", content: userMessage }],
  });
  const raw = extractText(response);
  return parseJSONLoose<T>(raw);
}

function extractText(response: Anthropic.Message): string {
  const parts: string[] = [];
  for (const block of response.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n").trim();
}

function parseJSONLoose<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.search(/[[{]/);
    const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new Error("Claude did not return parseable JSON: " + raw.slice(0, 300));
  }
}
