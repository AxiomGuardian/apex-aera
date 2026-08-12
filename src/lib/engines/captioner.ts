import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText } from "@/lib/ai/llm";
import { parseJson, PLATFORMS } from "./core";

const SYSTEM = `You are AERA's caption engine. Write platform-native captions for one content asset, strictly in the brand's voice.

Rules:
- One caption per requested platform, tuned to that platform's culture (length, tone, emoji norms, hashtag norms).
- Stay true to the brand tone of voice. Never invent product claims, prices, or facts not given.
- hashtags: platform-appropriate count (Instagram/TikTok more, LinkedIn/X few, google_business none).

Respond with STRICT JSON only:
{"captions": [{"platform": "...", "text": "...", "hashtags": ["tag1"]}]}`;

type Rec = { platform: string; fit: string };

export async function generateCaptions(sb: SupabaseClient, assetId: string) {
  const { data: asset } = await sb
    .from("content_assets")
    .select("id,brand_id,type,title,duration_seconds")
    .eq("id", assetId)
    .single();
  if (!asset) throw new Error("Asset not found");

  const [{ data: brand }, { data: analysis }] = await Promise.all([
    sb.from("brands").select("name,tone_of_voice,target_audience").eq("id", asset.brand_id).single(),
    sb.from("analyses").select("platform_recommendations,summary").eq("asset_id", assetId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const recs = ((analysis?.platform_recommendations ?? []) as Rec[])
    .filter((r) => r.fit === "strong" || r.fit === "moderate")
    .map((r) => r.platform)
    .filter((p) => (PLATFORMS as readonly string[]).includes(p));
  const fallback = asset.type === "image"
    ? ["instagram", "facebook"]
    : asset.type === "video_long"
    ? ["youtube", "facebook"]
    : ["instagram", "tiktok", "youtube"];
  const platforms = (recs.length ? recs : fallback).slice(0, 4);

  const prompt = [
    `BRAND: ${brand?.name ?? "Unknown"}`,
    `Tone of voice: ${brand?.tone_of_voice ?? "not specified"}`,
    `Target audience: ${brand?.target_audience ?? "not specified"}`,
    ``,
    `ASSET: ${asset.title ?? "Untitled"} (${asset.type}${asset.duration_seconds ? `, ${asset.duration_seconds}s` : ""})`,
    analysis?.summary ? `AERA's read on it: ${analysis.summary}` : ``,
    ``,
    `Write captions for: ${platforms.join(", ")}`,
  ].filter(Boolean).join("\n");

  const raw = await completeText({ system: SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 1200 });
  const parsed = parseJson<{ captions?: { platform: string; text: string; hashtags?: string[] }[] }>(raw);

  const rows = (parsed.captions ?? [])
    .filter((c) => (PLATFORMS as readonly string[]).includes(c.platform) && c.text?.trim())
    .map((c) => ({
      asset_id: asset.id,
      brand_id: asset.brand_id,
      platform: c.platform,
      text: c.text.trim(),
      hashtags: c.hashtags ?? [],
      status: "draft",
    }));
  if (!rows.length) throw new Error("Caption engine returned nothing usable");

  const { data, error } = await sb.from("captions").insert(rows).select();
  if (error) throw new Error(error.message);
  return data;
}
