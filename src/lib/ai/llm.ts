/**
 * Provider-agnostic LLM caller for AERA's engines.
 * If XAI_API_KEY is set → xAI (Grok). Otherwise → Anthropic (Claude).
 * Supports multi-image vision and Grok's built-in live search tools
 * (web_search + x_search) for trend research.
 */

import Anthropic from "@anthropic-ai/sdk";

export type ChatTurn = { role: "user" | "assistant"; content: string };

export function activeModel(): string {
  if (process.env.XAI_API_KEY) return process.env.XAI_MODEL ?? "grok-4.6";
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
  /** Creative temperature (0-1). Default: provider default. */
  temperature?: number;
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
    if (opts.temperature !== undefined) body.temperature = opts.temperature;
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
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? (textBlock as { type: "text"; text: string }).text : "";
}


// ── Native tool calling (xAI, OpenAI-compatible) ─────────────────────────
export type ToolDef = { name: string; description: string; parameters: Record<string, unknown> };
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };
export type ToolTurn =
  | { role: "user" | "assistant" | "system"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: { id: string; type: "function"; function: { name: string; arguments: string } }[] }
  | { role: "tool"; tool_call_id: string; content: string };

/**
 * One model step with tools. Returns either text, or tool calls to run.
 * Low reasoning effort by default: this is a conversational loop, speed matters.
 */
export async function stepWithTools(opts: {
  system: string;
  turns: ToolTurn[];
  tools: ToolDef[];
  maxTokens?: number;
  reasoning?: "low" | "medium" | "high";
}): Promise<{ text: string | null; calls: ToolCall[]; raw: ToolTurn | null }> {
  if (!process.env.XAI_API_KEY) throw new Error("Tool calling needs XAI_API_KEY");
  const body: Record<string, unknown> = {
    model: process.env.XAI_AGENT_MODEL ?? activeModel(),
    messages: [{ role: "system", content: opts.system }, ...opts.turns],
    tools: opts.tools.map((t) => ({ type: "function", function: { name: t.name, description: t.description, parameters: t.parameters } })),
    tool_choice: "auto",
    max_tokens: opts.maxTokens ?? 500,
    reasoning_effort: opts.reasoning ?? "low",
  };
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    // Some models reject reasoning_effort; retry without it once.
    if (res.status === 400 && body.reasoning_effort) {
      delete body.reasoning_effort;
      const r2 = await fetch("https://api.x.ai/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.XAI_API_KEY}` }, body: JSON.stringify(body) });
      if (!r2.ok) throw new Error(`xAI ${r2.status}: ${await r2.text()}`);
      return parseToolResponse(await r2.json());
    }
    throw new Error(`xAI ${res.status}: ${await res.text()}`);
  }
  return parseToolResponse(await res.json());
}

function parseToolResponse(j: unknown): { text: string | null; calls: ToolCall[]; raw: ToolTurn | null } {
  const msg = (j as { choices?: { message?: { content?: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[] }).choices?.[0]?.message;
  if (!msg) return { text: null, calls: [], raw: null };
  const calls: ToolCall[] = (msg.tool_calls ?? []).map((c) => {
    let args: Record<string, unknown> = {};
    try { args = JSON.parse(c.function.arguments || "{}"); } catch { args = {}; }
    return { id: c.id, name: c.function.name, args };
  });
  const raw: ToolTurn | null = calls.length
    ? { role: "assistant", content: msg.content ?? null, tool_calls: (msg.tool_calls ?? []).map((c) => ({ id: c.id, type: "function" as const, function: { name: c.function.name, arguments: c.function.arguments } })) }
    : null;
  return { text: msg.content ?? null, calls, raw };
}
