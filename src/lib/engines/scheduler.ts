import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText } from "@/lib/ai/llm";
import { parseJson, PLATFORMS, TZ } from "./core";

const SYSTEM = `You are AERA's scheduling engine. Given a content asset's platform recommendations and optimal posting windows, pick concrete date-times to post over the next 7 days.

Rules:
- Only schedule platforms rated strong or moderate.
- Times must be in the FUTURE relative to the provided current time, within the next 7 days, in the brand's timezone.
- One slot per platform, at most 4 slots total.
- Output exact ISO 8601 datetimes WITH timezone offset.

Respond with STRICT JSON only:
{"slots": [{"platform": "...", "scheduled_at": "2026-08-13T18:00:00-07:00", "reason": "..."}]}`;

type Rec = { platform: string; fit: string };

export async function scheduleAsset(sb: SupabaseClient, assetId: string) {
  const { data: asset } = await sb
    .from("content_assets")
    .select("id,brand_id,type,title,status")
    .eq("id", assetId)
    .single();
  if (!asset) throw new Error("Asset not found");

  const [{ data: brand }, { data: analysis }, { data: capRows }] = await Promise.all([
    sb.from("brands").select("autopilot,name").eq("id", asset.brand_id).single(),
    sb.from("analyses").select("platform_recommendations,posting_windows").eq("asset_id", assetId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    sb.from("captions").select("id,platform,created_at").eq("asset_id", assetId)
      .order("created_at", { ascending: false }),
  ]);
  if (!analysis) throw new Error("Analyze this asset before scheduling");

  const captionByPlatform = new Map<string, string>();
  for (const c of capRows ?? []) if (!captionByPlatform.has(c.platform)) captionByPlatform.set(c.platform, c.id);

  const now = new Date();
  const prompt = [
    `Current time: ${now.toISOString()} (brand timezone: ${TZ})`,
    `Asset: ${asset.title ?? "Untitled"} (${asset.type})`,
    `Platform recommendations: ${JSON.stringify(analysis.platform_recommendations ?? [])}`,
    `Optimal windows: ${JSON.stringify(analysis.posting_windows ?? [])}`,
  ].join("\n");

  const raw = await completeText({ system: SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 800 });
  const parsed = parseJson<{ slots?: { platform: string; scheduled_at: string; reason?: string }[] }>(raw);

  const minTime = now.getTime() + 5 * 60 * 1000;
  const maxTime = now.getTime() + 8 * 24 * 3600 * 1000;
  const recs = ((analysis.platform_recommendations ?? []) as Rec[])
    .filter((r) => r.fit === "strong" || r.fit === "moderate").map((r) => r.platform);

  const rows = (parsed.slots ?? [])
    .filter((s) => (PLATFORMS as readonly string[]).includes(s.platform))
    .filter((s) => recs.length === 0 || recs.includes(s.platform))
    .filter((s) => {
      const t = Date.parse(s.scheduled_at);
      return Number.isFinite(t) && t >= minTime && t <= maxTime;
    })
    .slice(0, 4)
    .map((s) => ({
      brand_id: asset.brand_id,
      asset_id: asset.id,
      caption_id: captionByPlatform.get(s.platform) ?? null,
      platform: s.platform,
      scheduled_at: new Date(s.scheduled_at).toISOString(),
      status: brand?.autopilot ? "approved" : "proposed",
    }));
  if (!rows.length) throw new Error("Scheduler produced no valid future slots");

  const { data, error } = await sb.from("scheduled_posts").insert(rows).select();
  if (error) throw new Error(error.message);

  await sb.from("content_assets").update({ status: "scheduled" }).eq("id", asset.id);
  return data;
}
