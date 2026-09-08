import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";
import { completeText, type ChatTurn } from "@/lib/ai/llm";
import { publishOne } from "@/lib/engines/publisher";
import { readBrandVoice } from "@/lib/engines/voice";

/**
 * AERA voice layer: talk, decide, act.
 * POST { messages, confirm?: boolean }
 * -> { say, actions: [{tool, args, result}], ui: [{type, ...}], needsConfirm?: {tool,args,prompt} }
 *
 * The model answers in JSON with a short spoken reply plus zero or more tool calls
 * from a fixed whitelist. Reads and safe edits run immediately under the user's RLS.
 * Irreversible tools (publish_now, cancel_post, disconnect) come back as needsConfirm
 * until the client sends confirm: true.
 */

export const maxDuration = 60;

type Tool =
  | "navigate" | "highlight"
  | "list_queue" | "list_content" | "brand_summary"
  | "reschedule_post" | "retitle_post" | "approve_post" | "cancel_post"
  | "set_autopilot" | "update_voice" | "read_voice"
  | "publish_now";

const DANGEROUS: Tool[] = ["publish_now", "cancel_post"];

const TOOL_DOC = `
TOOLS (call by name with args; only these exist):
- navigate {tab: "dashboard"|"clients"|"brand"|"content"|"queue"|"aera"}  moves the app to a screen
- highlight {kind: "post"|"brand"|"asset", id}  draws attention to one item on screen
- list_queue {brandId?}  posts scheduled or waiting
- list_content {brandId?}  recent uploads
- brand_summary {brandId?}  voice, platforms, autopilot, billing
- reschedule_post {postId, scheduledAt (ISO 8601 with timezone)}  move a post
- retitle_post {postId, title}  rename the content behind a post
- approve_post {postId}  approve a proposed post
- cancel_post {postId}  pull a post (irreversible)
- set_autopilot {brandId, on: boolean}
- update_voice {brandId, tone?, audience?, website?}
- read_voice {brandId}  ask the Voice Reader engine to re-read the brand
- publish_now {postId}  publish immediately (irreversible)
`;

const SYSTEM = `You are AERA, the APEX AERA marketing intelligence, speaking out loud to the person who runs this brand.
Answer ONLY with JSON: {"say": string, "tools": [{"tool": string, "args": object}]}.
"say" is what you will speak: one to three short sentences, natural, warm, specific, no lists, no markdown, no em dashes, spell your name AERA.
Use tools whenever the request needs data or a change. Read tools first when unsure of ids; the results come back to you and you answer again.
When you change something, say what changed. When you navigate or highlight, mention it briefly ("I have pulled up the queue.").
Infer the brand's industry from its voice, audience and website and shape suggestions for it (real estate, construction, e-commerce, creator, fitness, restaurant, services).
Never invent posts, numbers or ids. If there is nothing scheduled, say so and suggest one concrete next post.
${TOOL_DOC}`;

type Call = { tool: Tool; args: Record<string, unknown> };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { messages, confirm } = (await request.json()) as { messages: { role: string; content: string }[]; confirm?: boolean };
  if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ error: "messages required" }, { status: 400 });

  // Live context: brands the user can see
  const { data: brands } = await supabase.from("brands").select("id,name,tone_of_voice,target_audience,website_url,autopilot,billing_status,status").neq("status", "archived").limit(8);
  const brandList = (brands ?? []).map((b) => `- ${b.name} (id ${b.id}) tone: ${b.tone_of_voice ?? "unset"}; audience: ${b.target_audience ?? "unset"}; site: ${b.website_url ?? "none"}; autopilot ${b.autopilot === false ? "off" : "on"}; billing ${b.billing_status ?? "active"}`).join("\n");
  const context = `BRANDS YOU CAN ACT ON:\n${brandList || "(none)"}\nToday: ${new Date().toISOString()} (Phoenix time is UTC-7).`;

  const turns: ChatTurn[] = messages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
  const executed: { tool: Tool; args: Record<string, unknown>; result: unknown }[] = [];
  const ui: Record<string, unknown>[] = [];
  let say = "";

  // Up to 3 rounds: model -> tools -> model
  for (let round = 0; round < 3; round++) {
    const raw = await completeText({ system: SYSTEM + "\n\n" + context, messages: turns, maxTokens: 700 });
    const parsed = parseJson(raw);
    say = parsed.say || say;
    const calls = parsed.tools ?? [];
    if (calls.length === 0) break;

    const results: string[] = [];
    for (const c of calls) {
      if (DANGEROUS.includes(c.tool) && !confirm) {
        const prompt = c.tool === "publish_now" ? "Publish this post right now?" : "Pull this post from the queue?";
        return NextResponse.json({ say: say || prompt, actions: executed, ui, needsConfirm: { tool: c.tool, args: c.args, prompt } });
      }
      const r = await run(c, supabase, u.user.id, ui);
      executed.push({ tool: c.tool, args: c.args, result: r });
      results.push(`${c.tool} -> ${JSON.stringify(r).slice(0, 900)}`);
    }
    turns.push({ role: "assistant", content: JSON.stringify(parsed) });
    turns.push({ role: "user", content: "TOOL RESULTS:\n" + results.join("\n") + "\nNow answer the person with the final JSON (say + any further tools)." });
  }

  return NextResponse.json({ say: say || "Done.", actions: executed, ui });
}

function parseJson(raw: string): { say?: string; tools?: Call[] } {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return { say: raw.trim() };
  try { return JSON.parse(m[0]) as { say?: string; tools?: Call[] }; } catch { return { say: raw.trim() }; }
}

async function run(c: Call, sb: Awaited<ReturnType<typeof createClient>>, userId: string, ui: Record<string, unknown>[]): Promise<unknown> {
  const a = c.args ?? {};
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);
  const log = async (brandId: string | undefined, event: string, reason: string) => {
    if (!brandId) return;
    await adminClient().from("lifecycle_events").insert({ brand_id: brandId, event, reason, actor: "aera:" + userId }).then(() => {}, () => {});
  };

  switch (c.tool) {
    case "navigate": ui.push({ type: "navigate", tab: s("tab") ?? "dashboard" }); return { ok: true };
    case "highlight": ui.push({ type: "highlight", kind: s("kind") ?? "post", id: s("id") }); return { ok: true };

    case "list_queue": {
      let q = sb.from("scheduled_posts").select("id,brand_id,platform,scheduled_at,status,content_assets(title),brands(name)").in("status", ["proposed", "approved", "locked"]).order("scheduled_at").limit(20);
      if (s("brandId")) q = q.eq("brand_id", s("brandId")!);
      const { data } = await q;
      ui.push({ type: "navigate", tab: "queue" });
      return data ?? [];
    }
    case "list_content": {
      let q = sb.from("content_assets").select("id,brand_id,title,type,status,created_at").order("created_at", { ascending: false }).limit(15);
      if (s("brandId")) q = q.eq("brand_id", s("brandId")!);
      const { data } = await q;
      return data ?? [];
    }
    case "brand_summary": {
      let q = sb.from("brands").select("id,name,tone_of_voice,target_audience,website_url,autopilot,billing_status,voice_profile,voice_confirmed_at").limit(5);
      if (s("brandId")) q = q.eq("id", s("brandId")!);
      const { data: bs } = await q;
      const out = [];
      for (const b of bs ?? []) {
        const { data: conns } = await sb.from("platform_connections").select("platform,status,account_name").eq("brand_id", b.id);
        out.push({ ...b, platforms: conns ?? [] });
      }
      return out;
    }
    case "reschedule_post": {
      const id = s("postId"); const when = s("scheduledAt");
      if (!id || !when || isNaN(Date.parse(when))) return { ok: false, error: "postId and a valid scheduledAt are required" };
      const { data: post } = await sb.from("scheduled_posts").select("brand_id").eq("id", id).maybeSingle();
      const { error } = await sb.from("scheduled_posts").update({ scheduled_at: new Date(when).toISOString() }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      await log(post?.brand_id, "post_rescheduled", "AERA moved a post to " + when);
      ui.push({ type: "navigate", tab: "queue" }, { type: "highlight", kind: "post", id }, { type: "refresh" });
      return { ok: true, scheduledAt: when };
    }
    case "retitle_post": {
      const id = s("postId"); const title = s("title");
      if (!id || !title) return { ok: false, error: "postId and title required" };
      const { data: post } = await sb.from("scheduled_posts").select("asset_id,brand_id").eq("id", id).maybeSingle();
      if (!post?.asset_id) return { ok: false, error: "That post has no content attached" };
      const { error } = await sb.from("content_assets").update({ title }).eq("id", post.asset_id);
      if (error) return { ok: false, error: error.message };
      await log(post.brand_id, "asset_retitled", "AERA retitled content to " + title);
      ui.push({ type: "highlight", kind: "post", id }, { type: "refresh" });
      return { ok: true, title };
    }
    case "approve_post": {
      const id = s("postId"); if (!id) return { ok: false, error: "postId required" };
      const { error } = await sb.from("scheduled_posts").update({ status: "approved" }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      ui.push({ type: "navigate", tab: "queue" }, { type: "highlight", kind: "post", id }, { type: "refresh" });
      return { ok: true };
    }
    case "cancel_post": {
      const id = s("postId"); if (!id) return { ok: false, error: "postId required" };
      const { error } = await sb.from("scheduled_posts").update({ status: "cancelled" }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      ui.push({ type: "navigate", tab: "queue" }, { type: "refresh" });
      return { ok: true };
    }
    case "set_autopilot": {
      const id = s("brandId"); const on = a["on"] === true || a["on"] === "true";
      if (!id) return { ok: false, error: "brandId required" };
      const { error } = await sb.from("brands").update({ autopilot: on }).eq("id", id);
      if (error) return { ok: false, error: error.message };
      await log(id, "autopilot_" + (on ? "on" : "off"), "AERA changed autopilot by voice");
      ui.push({ type: "navigate", tab: "brand" }, { type: "refresh" });
      return { ok: true, autopilot: on };
    }
    case "update_voice": {
      const id = s("brandId"); if (!id) return { ok: false, error: "brandId required" };
      const patch: Record<string, string> = {};
      if (s("tone")) patch.tone_of_voice = s("tone")!;
      if (s("audience")) patch.target_audience = s("audience")!;
      if (s("website")) patch.website_url = s("website")!;
      if (!Object.keys(patch).length) return { ok: false, error: "nothing to update" };
      const { error } = await sb.from("brands").update(patch).eq("id", id);
      if (error) return { ok: false, error: error.message };
      await log(id, "voice_updated", "AERA updated brand voice by request");
      ui.push({ type: "navigate", tab: "brand" }, { type: "refresh" });
      return { ok: true, ...patch };
    }
    case "read_voice": {
      const id = s("brandId"); if (!id) return { ok: false, error: "brandId required" };
      const profile = await readBrandVoice(adminClient(), id);
      ui.push({ type: "navigate", tab: "brand" }, { type: "refresh" });
      return { ok: true, profile };
    }
    case "publish_now": {
      const id = s("postId"); if (!id) return { ok: false, error: "postId required" };
      const { data: post } = await sb.from("scheduled_posts").select("id").eq("id", id).maybeSingle();
      if (!post) return { ok: false, error: "No access to that post" };
      const r = await publishOne(adminClient(), id);
      ui.push({ type: "navigate", tab: "queue" }, { type: "refresh" });
      return r;
    }
    default: return { ok: false, error: "unknown tool" };
  }
}
