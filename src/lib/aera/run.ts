import type { SupabaseClient } from "@supabase/supabase-js";
import { stepWithTools, type ToolTurn } from "@/lib/ai/llm";
import { TOOLS, DANGEROUS, runTool } from "@/lib/aera/tools";
import { stepLabel, type Step } from "@/lib/aera/steps";
import { writeLog, type LogEvent } from "@/lib/log/server";

/**
 * One turn of AERA: think, call tools, think again, answer.
 *
 * Shared by the plain route and the streaming route so the phone, the chat page
 * and the side panel all get the same brain and the same activity log. onStep
 * fires the moment a tool finishes, which is what makes the live trail live.
 */

export const SYSTEM = `You are AERA, the marketing intelligence at the heart of APEX AERA, speaking out loud to the person who runs this brand. Your name is AERA, spelled A E R A. Never call yourself Sarah.
Speak in one to three short, natural sentences. No lists, no markdown, no em dashes. Lead with the answer.
Use tools whenever a request needs data or a change. Call read tools first when you need ids. After a change, say exactly what changed.
When you navigate or highlight, say so briefly ("I have the queue up.").
Infer the brand's industry from its voice, audience and website and shape suggestions for it. Suggest concrete next posts, not generic advice.
Never invent posts, numbers or ids. If nothing is scheduled, say so and propose one specific post.
Use remember when you learn a preference, a goal, a deadline, or a fact about the business that will matter later.`;

export type AeraResult = {
  say: string;
  steps: Step[];
  ui: Record<string, unknown>[];
  actions: { tool: string; args: Record<string, unknown>; result: unknown }[];
  needsConfirm?: { tool: string; args: Record<string, unknown>; prompt: string };
  error?: string;
};

export async function buildContext(supabase: SupabaseClient): Promise<string> {
  const [{ data: brands }, { data: mems }] = await Promise.all([
    supabase.from("brands").select("id,name,tone_of_voice,target_audience,website_url,autopilot,billing_status,status").neq("status", "archived").limit(8),
    supabase.from("aera_memories").select("note,brand_id,created_at").order("created_at", { ascending: false }).limit(25),
  ]);
  const brandList = (brands ?? []).map((b) => `- ${b.name} (id ${b.id}) tone: ${b.tone_of_voice ?? "unset"}; audience: ${b.target_audience ?? "unset"}; site: ${b.website_url ?? "none"}; autopilot ${b.autopilot === false ? "off" : "on"}; billing ${b.billing_status ?? "active"}`).join("\n");
  const memory = (mems ?? []).map((m) => m.note).map((n) => `- ${n}`).join("\n");
  return `BRANDS YOU CAN ACT ON:\n${brandList || "(none)"}\n\nWHAT YOU REMEMBER:\n${memory || "(nothing yet)"}\n\nNow: ${new Date().toISOString()} (Phoenix is UTC-7).`;
}

export async function runAera(opts: {
  supabase: SupabaseClient;
  userId: string;
  messages: { role: string; content: string }[];
  confirm?: boolean;
  surface?: "web" | "ios";
  onStep?: (step: Step) => void;
  onPhase?: (phase: string) => void;
}): Promise<AeraResult> {
  const { supabase, userId, messages, confirm } = opts;
  const surface = opts.surface ?? "web";
  const started = Date.now();
  const asked = messages[messages.length - 1]?.content?.slice(0, 200) ?? "";

  const context = await buildContext(supabase);
  const turns: ToolTurn[] = messages.slice(-16).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));

  const actions: AeraResult["actions"] = [];
  const steps: Step[] = [];
  const logs: LogEvent[] = [];
  const ui: Record<string, unknown>[] = [];

  const finish = (r: AeraResult, ok: boolean, extra: Record<string, unknown> = {}) => {
    logs.push({
      event: "aera.turn", area: "chat", surface, ok, ms: Date.now() - started, label: asked,
      detail: { steps: steps.map((x) => x.tool), reply: r.say.slice(0, 300), ...extra },
    });
    void writeLog(userId, logs, surface);
    return r;
  };

  try {
    for (let round = 0; round < 4; round++) {
      opts.onPhase?.(round === 0 ? "thinking" : "thinking again");
      const step = await stepWithTools({ system: SYSTEM + "\n\n" + context, turns, tools: TOOLS, maxTokens: 400, reasoning: "low" });

      if (step.calls.length === 0) {
        const say = (step.text ?? "").trim() || "Done.";
        return finish({ say, steps, ui, actions }, true, { rounds: round + 1 });
      }
      if (step.raw) turns.push(step.raw);

      for (const c of step.calls) {
        if (DANGEROUS.has(c.name) && !confirm) {
          const prompt = c.name === "publish_now" ? "Publish this post right now?" : "Pull this post from the queue?";
          logs.push({ event: "aera.confirm", area: "chat", surface, ok: true, label: "Asked before " + stepLabel(c.name, c.args).toLowerCase(), detail: { tool: c.name, args: c.args } });
          return finish({ say: prompt, steps, ui, actions, needsConfirm: { tool: c.name, args: c.args, prompt } }, true, { awaitingConfirm: c.name });
        }

        const label = stepLabel(c.name, c.args);
        opts.onPhase?.(label);
        const t0 = Date.now();
        const result = await runTool(c.name, c.args, supabase, userId, ui);
        const took = Date.now() - t0;
        const failed = !!(result && typeof result === "object" && (result as { ok?: boolean }).ok === false);

        const s: Step = { tool: c.name, label, ok: !failed, ms: took };
        steps.push(s);
        opts.onStep?.(s);
        logs.push({ event: "aera.tool", area: "chat", surface, ok: !failed, ms: took, label, detail: { tool: c.name, args: c.args, result: JSON.stringify(result ?? null).slice(0, 800) } });
        actions.push({ tool: c.name, args: c.args, result });
        turns.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(result).slice(0, 4000) });
      }
    }
    return finish({ say: "I did that. Anything else?", steps, ui, actions }, true, { capped: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[AERA run]", message);
    return finish({ say: "I hit a snag reaching my tools. Try that again in a moment.", steps, ui, actions, error: message }, false, { error: message.slice(0, 500) });
  }
}
