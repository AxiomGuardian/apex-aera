import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";
import { completeText, type ToolDef } from "@/lib/ai/llm";
import { publishOne } from "@/lib/engines/publisher";
import { readBrandVoice } from "@/lib/engines/voice";

/** AERA's hands. Shared by the chat brain, the voice layer, and the realtime voice session. */

export const DANGEROUS = new Set(["publish_now", "cancel_post"]);

export const TOOLS: ToolDef[] = [
  { name: "navigate", description: "Move the app to a screen.", parameters: { type: "object", properties: { tab: { type: "string", enum: ["dashboard", "clients", "brand", "content", "queue", "aera"] } }, required: ["tab"] } },
  { name: "highlight", description: "Draw attention to one item on screen.", parameters: { type: "object", properties: { kind: { type: "string", enum: ["post", "brand", "asset"] }, id: { type: "string" } }, required: ["kind", "id"] } },
  { name: "list_queue", description: "Posts scheduled or waiting for approval.", parameters: { type: "object", properties: { brandId: { type: "string" } } } },
  { name: "list_content", description: "Recent uploads for a brand.", parameters: { type: "object", properties: { brandId: { type: "string" } } } },
  { name: "brand_summary", description: "Voice, platforms, autopilot, billing for a brand (or all).", parameters: { type: "object", properties: { brandId: { type: "string" } } } },
  { name: "look_at_content", description: "Actually look at an uploaded image or video frames and describe what is in it.", parameters: { type: "object", properties: { assetId: { type: "string" } }, required: ["assetId"] } },
  { name: "social_search", description: "Search what is trending or being posted right now on Instagram, TikTok, X, YouTube or the open web for a topic.", parameters: { type: "object", properties: { query: { type: "string" }, platform: { type: "string", enum: ["instagram", "tiktok", "x", "youtube", "web", "all"] } }, required: ["query"] } },
  { name: "remember", description: "Save something worth remembering about this person or brand for future conversations.", parameters: { type: "object", properties: { note: { type: "string" }, brandId: { type: "string" } }, required: ["note"] } },
  { name: "reschedule_post", description: "Move a post to a new time.", parameters: { type: "object", properties: { postId: { type: "string" }, scheduledAt: { type: "string", description: "ISO 8601 with timezone offset" } }, required: ["postId", "scheduledAt"] } },
  { name: "retitle_post", description: "Rename the content behind a post.", parameters: { type: "object", properties: { postId: { type: "string" }, title: { type: "string" } }, required: ["postId", "title"] } },
  { name: "approve_post", description: "Approve a proposed post.", parameters: { type: "object", properties: { postId: { type: "string" } }, required: ["postId"] } },
  { name: "cancel_post", description: "Pull a post from the queue. Irreversible. Ask the person first, then pass confirm true.", parameters: { type: "object", properties: { postId: { type: "string" }, confirm: { type: "boolean" } }, required: ["postId"] } },
  { name: "set_autopilot", description: "Turn autopilot on or off for a brand.", parameters: { type: "object", properties: { brandId: { type: "string" }, on: { type: "boolean" } }, required: ["brandId", "on"] } },
  { name: "update_voice", description: "Update tone, audience or website for a brand.", parameters: { type: "object", properties: { brandId: { type: "string" }, tone: { type: "string" }, audience: { type: "string" }, website: { type: "string" } }, required: ["brandId"] } },
  { name: "read_voice", description: "Ask the Voice Reader engine to re-read and interpret the brand voice.", parameters: { type: "object", properties: { brandId: { type: "string" } }, required: ["brandId"] } },
  { name: "publish_now", description: "Publish a queued post immediately. Irreversible. Ask the person first, then pass confirm true.", parameters: { type: "object", properties: { postId: { type: "string" }, confirm: { type: "boolean" } }, required: ["postId"] } },
];


export type SB = Awaited<ReturnType<typeof createClient>>;

export async function runTool(tool: string, a: Record<string, unknown>, sb: SB, userId: string, ui: Record<string, unknown>[]): Promise<unknown> {
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string) : undefined);
  const log = async (brandId: string | undefined, event: string, reason: string) => {
    if (!brandId) return;
    await adminClient().from("lifecycle_events").insert({ brand_id: brandId, event, reason, actor: "aera:" + userId }).then(() => {}, () => {});
  };

  switch (tool) {
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
      let q = sb.from("content_assets").select("id,brand_id,title,type,status,description,created_at").order("created_at", { ascending: false }).limit(15);
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
    case "look_at_content": {
      const id = s("assetId"); if (!id) return { ok: false, error: "assetId required" };
      const { data: asset } = await sb.from("content_assets").select("id,title,type,storage_path,metadata,transcript").eq("id", id).maybeSingle();
      if (!asset?.storage_path) return { ok: false, error: "No file for that content" };
      const admin = adminClient();
      const urls: string[] = [];
      const frames = ((asset.metadata as { frames?: string[] } | null)?.frames ?? []).slice(0, 3);
      if (String(asset.type).startsWith("video") && frames.length) {
        for (const f of frames) { const { data } = await admin.storage.from("thumbnails").createSignedUrl(f, 600); if (data?.signedUrl) urls.push(data.signedUrl); }
      } else {
        const { data } = await admin.storage.from("media").createSignedUrl(asset.storage_path, 600); if (data?.signedUrl) urls.push(data.signedUrl);
      }
      if (!urls.length) return { ok: false, error: "Could not open the file" };
      const seen = await completeText({ system: "Describe this marketing content precisely in 3 sentences: subject, setting, mood, text on screen, and what platform it suits.", messages: [{ role: "user", content: "What is in this?" + (asset.transcript ? " Transcript: " + String(asset.transcript).slice(0, 800) : "") }], imageUrls: urls, maxTokens: 300 });
      ui.push({ type: "navigate", tab: "content" }, { type: "highlight", kind: "asset", id });
      return { ok: true, title: asset.title, description: seen };
    }
    case "social_search": {
      const query = s("query"); if (!query) return { ok: false, error: "query required" };
      const platform = s("platform") ?? "all";
      const site = platform === "instagram" ? "site:instagram.com" : platform === "tiktok" ? "site:tiktok.com" : platform === "youtube" ? "site:youtube.com" : platform === "x" ? "" : "";
      const text = await completeText({
        system: "You are a social media trend researcher. Use live search. Return 4 to 6 concrete findings: what formats, hooks, sounds or angles are getting traction right now for the topic, with the platform each comes from. Plain sentences, no markdown, no links.",
        messages: [{ role: "user", content: `${platform === "all" ? "Across Instagram, TikTok, X and YouTube" : "On " + platform}: what is trending right now about "${query}"? ${site}`.trim() }],
        liveSearch: true, maxTokens: 600,
      });
      return { ok: true, platform, findings: text };
    }
    case "remember": {
      const note = s("note"); if (!note) return { ok: false, error: "note required" };
      const { error } = await sb.from("aera_memories").insert({ user_id: userId, brand_id: s("brandId") ?? null, note: note.slice(0, 400) });
      return error ? { ok: false, error: error.message } : { ok: true };
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
