/**
 * Provider-agnostic LLM caller for AERA's engines.
 * If XAI_API_KEY is set → xAI (Grok). Otherwise → Anthropic (Claude).
 * Switching providers = paste a key in .env.local. No code changes.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function activeModel(): string {
  if (process.env.XAI_API_KEY) return process.env.XAI_MODEL ?? "grok-4";
  return process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
}

export async function completeText(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  /** Optional image (signed URL) attached to the last user message */
  imageUrl?: string;
}): Promise<string> {
  const maxTokens = opts.maxTokens ?? 2048;

  // ── xAI / Grok (OpenAI-compatible) ─────────────────────────────
  if (process.env.XAI_API_KEY) {
    const messages: unknown[] = [{ role: "system", content: opts.system }];
    opts.messages.forEach((m, i) => {
      const isLastUser = i === opts.messages.length - 1 && m.role === "user";
      if (isLastUser && opts.imageUrl) {
        messages.push({
          role: "user",
          content: [
            { type: "image_url", image_url: { url: opts.imageUrl } },
            { type: "text", text: m.content },
          ],
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({ model: activeModel(), messages, max_tokens: maxTokens }),
    });
    if (!res.ok) throw new Error(`xAI ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  }

  // ── Anthropic / Claude ─────────────────────────────────────────
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const content: Anthropic.ContentBlockParam[] = [];
  const turns: Anthropic.MessageParam[] = opts.messages.map((m, i) => {
    const isLastUser = i === opts.messages.length - 1 && m.role === "user";
    if (isLastUser && opts.imageUrl) {
      return {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: opts.imageUrl } },
          { type: "text", text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
  void content;
  const response = await anthropic.messages.create({
    model: activeModel(),
    max_tokens: maxTokens,
    system: opts.system,
    messages: turns,
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? (textBlock as { type: "text"; text: string }).text : "";
}
