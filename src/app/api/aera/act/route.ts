import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stepWithTools, type ToolTurn } from "@/lib/ai/llm";
import { TOOLS, DANGEROUS, runTool } from "@/lib/aera/tools";

/**
 * AERA: talk, decide, act. Native tool calling on Grok.
 * POST { messages, confirm?: boolean }
 * -> { say, actions, ui, needsConfirm? }
 *
 * Reads and safe edits run immediately under the user's own RLS. Irreversible
 * tools (publish_now, cancel_post) come back as needsConfirm until confirm: true.
 */

export const maxDuration = 60;

const SYSTEM = `You are AERA, the marketing intelligence at the heart of APEX AERA, speaking out loud to the person who runs this brand. Your name is AERA, spelled A E R A. Never call yourself Sarah.
Speak in one to three short, natural sentences. No lists, no markdown, no em dashes. Lead with the answer.
Use tools whenever a request needs data or a change. Call read tools first when you need ids. After a change, say exactly what changed.
When you navigate or highlight, say so briefly ("I have the queue up.").
Infer the brand's industry from its voice, audience and website and shape suggestions for it. Suggest concrete next posts, not generic advice.
Never invent posts, numbers or ids. If nothing is scheduled, say so and propose one specific post.
Use remember when you learn a preference, a goal, a deadline, or a fact about the business that will matter later.`;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { messages, confirm } = (await request.json()) as { messages: { role: string; content: string }[]; confirm?: boolean };
  if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ error: "messages required" }, { status: 400 });

  // Live context + memory
  const [{ data: brands }, { data: mems }] = await Promise.all([
    supabase.from("brands").select("id,name,tone_of_voice,target_audience,website_url,autopilot,billing_status,status").neq("status", "archived").limit(8),
    supabase.from("aera_memories").select("note,brand_id,created_at").order("created_at", { ascending: false }).limit(25),
  ]);
  const brandList = (brands ?? []).map((b) => `- ${b.name} (id ${b.id}) tone: ${b.tone_of_voice ?? "unset"}; audience: ${b.target_audience ?? "unset"}; site: ${b.website_url ?? "none"}; autopilot ${b.autopilot === false ? "off" : "on"}; billing ${b.billing_status ?? "active"}`).join("\n");
  const memory = (mems ?? []).map((m) => `- ${m.note}`).join("\n");
  const context = `BRANDS YOU CAN ACT ON:\n${brandList || "(none)"}\n\nWHAT YOU REMEMBER:\n${memory || "(nothing yet)"}\n\nNow: ${new Date().toISOString()} (Phoenix is UTC-7).`;

  const turns: ToolTurn[] = messages.slice(-16).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
  const executed: { tool: string; args: Record<string, unknown>; result: unknown }[] = [];
  const ui: Record<string, unknown>[] = [];

  try {
    for (let round = 0; round < 4; round++) {
      const step = await stepWithTools({ system: SYSTEM + "\n\n" + context, turns, tools: TOOLS, maxTokens: 400, reasoning: "low" });
      if (step.calls.length === 0) {
        return NextResponse.json({ say: (step.text ?? "").trim() || "Done.", actions: executed, ui });
      }
      if (step.raw) turns.push(step.raw);
      for (const c of step.calls) {
        if (DANGEROUS.has(c.name) && !confirm) {
          const prompt = c.name === "publish_now" ? "Publish this post right now?" : "Pull this post from the queue?";
          return NextResponse.json({ say: prompt, actions: executed, ui, needsConfirm: { tool: c.name, args: c.args, prompt } });
        }
        const r = await runTool(c.name, c.args, supabase, u.user.id, ui);
        executed.push({ tool: c.name, args: c.args, result: r });
        turns.push({ role: "tool", tool_call_id: c.id, content: JSON.stringify(r).slice(0, 4000) });
      }
    }
    return NextResponse.json({ say: "I did that. Anything else?", actions: executed, ui });
  } catch (e) {
    console.error("[AERA act]", e);
    return NextResponse.json({ say: "I hit a snag reaching my tools. Try that again in a moment.", actions: executed, ui, error: e instanceof Error ? e.message : String(e) }, { status: 200 });
  }
}

