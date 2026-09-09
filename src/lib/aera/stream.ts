"use client";

import type { Step } from "@/lib/aera/steps";
import { log, logError } from "@/lib/log/client";

export type UIDirective = { type: string; tab?: string; kind?: string; id?: string };
export type AeraDone = { say: string; steps: Step[]; ui: UIDirective[]; needsConfirm?: { tool: string; prompt: string } | null; error?: string | null };

/**
 * Asks AERA and reports her work as it happens.
 * Falls back to the plain route if streaming is unavailable, so nothing breaks.
 */
export async function askAera(
  messages: { role: string; content: string }[],
  opts: { confirm?: boolean; onPhase?: (label: string) => void; onStep?: (s: Step) => void } = {},
): Promise<AeraDone> {
  const t0 = performance.now();
  const body = JSON.stringify({ messages, confirm: opts.confirm ?? false });
  try {
    const r = await fetch("/api/aera/act/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body });
    if (!r.ok || !r.body) throw new Error("stream " + r.status);

    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done: AeraDone | null = null;

    for (;;) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        let e: Record<string, unknown>;
        try { e = JSON.parse(line.slice(5).trim()) as Record<string, unknown>; } catch { continue; }
        if (e.t === "phase") opts.onPhase?.(String(e.label ?? "Thinking"));
        else if (e.t === "step") opts.onStep?.({ tool: String(e.tool), label: String(e.label), ok: e.ok !== false, ms: typeof e.ms === "number" ? e.ms : undefined });
        else if (e.t === "done") done = { say: String(e.say ?? "Done."), steps: (e.steps as Step[]) ?? [], ui: (e.ui as UIDirective[]) ?? [], needsConfirm: (e.needsConfirm as AeraDone["needsConfirm"]) ?? null, error: (e.error as string) ?? null };
      }
    }
    if (!done) throw new Error("stream ended early");
    log("aera.ask", { area: "chat", ok: !done.error, ms: performance.now() - t0, label: (messages[messages.length - 1]?.content ?? "").slice(0, 200), detail: { steps: done.steps.map((s) => s.tool), streamed: true } });
    return done;
  } catch (streamErr) {
    // Plain route, so a proxy that buffers streams never costs the person an answer.
    try {
      const r = await fetch("/api/aera/act", { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const j = (await r.json()) as AeraDone;
      log("aera.ask", { area: "chat", ok: true, ms: performance.now() - t0, label: (messages[messages.length - 1]?.content ?? "").slice(0, 200), detail: { streamed: false, why: String(streamErr).slice(0, 200) } });
      return { say: j.say ?? "Done.", steps: j.steps ?? [], ui: j.ui ?? [], needsConfirm: j.needsConfirm ?? null, error: j.error ?? null };
    } catch (e) {
      logError("aera.ask", e, { area: "chat", ms: performance.now() - t0, label: (messages[messages.length - 1]?.content ?? "").slice(0, 200) });
      return { say: "I could not reach the server just now.", steps: [], ui: [], needsConfirm: null, error: String(e) };
    }
  }
}
