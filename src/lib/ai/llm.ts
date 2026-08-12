/**
 * Provider-agnostic LLM caller for AERA's engines.
 * If XAI_API_KEY is set → xAI (Grok). Otherwise → Anthropic (Claude).
 * Supports multi-image vision and Grok's built-in live search tools
 * (web_search + x_search) for trend research.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function activeModel(): string {
  if (process.env.XAI_API_KEY) return process.env.XAI_MODEL ?? "grok-4";
  return process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
}

function searchModel(): string {
  return process.env.XAI_SEARCH_MODEL ?? "grok-4.6";
}

export async function completeText(opts: {
  system: string;
  messages: ChatTurn[];
  maxTokens?: number;
  /** One image (signed URL) attached to the last user message */
  imageUrl?: string;
  /** Multiple images (signed URLs) attached to the last user message */
  imageUrls?: string[];
  /** Grok live search (web_search + x_search built-in tools). xAI only. */
  liveSearch?: boolean;
}): Promise<string> {
  const maxTokens = opts.maxTokens ?? 2048;
  const images = opts.imageUrls ?? (opts.imageUrl ? [opts.imageUrl] : []);

  // ── xAI / Grok (OpenAI-compatible) ─────────────────────────────
  if (process.env.XAI_API_KEY) {
    const messages: unknown[] = [{ role: "system", content: opts.system }];
    opts.messages.forEach((m, i) => {
      const isLastUser = i === opts.messages.length - 1 && m.role === "user";
      if (isLastUser && images.length) {
        messages.push({
          role: "user",
          content: [
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
            { type: "text", text: m.content },
          ],
        });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });

    const body: Record<string, unknown> = {
      model: opts.liveSearch ? searchModel() : activeModel(),
      messages,
      max_tokens: maxTokens,
    };
    if (opts.liveSearch) {
      body.tools = [{ type: "web_search" }, { type: "x_search" }];
    }

    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`xAI ${res.status}: ${await res.text()}`);
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  }

  // ── Anthropic / Claude (no live search here — generates from knowledge) ──
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const turns: Anthropic.MessageParam[] = opts.messages.map((m, i) => {
    const isLastUser = i === opts.messages.length - 1 && m.role === "user";
    if (isLastUser && images.length) {
      return {
        role: "user",
        content: [
          ...images.map((url) => ({ type: "image" as const, source: { type: "url" as const, url } })),
          { type: "text" as const, text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
  const response = await anthropic.messages.create({
    model: activeModel(),
    max_tokens: maxTokens,
    system: opts.system,
    messages: turns,
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? (textBlock as { type: "text"; text: string }).text : "";
}
