import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText } from "@/lib/ai/llm";
import { parseJson, PLATFORMS } from "./core";
import { getFreshBrief } from "./trends";

const SYSTEM = `You are AERA's caption engine. Write scroll-stopping, platform-native captions for one piece of content, in the brand's voice.

Rules:
- Write about the CONTENT. Use the creator's description and AERA's analysis as your source of truth. Never invent facts, claims, or details you weren't given.
- Do NOT stuff the brand or workspace name into captions. Never use a company or workspace name as a hashtag. Mention the brand only if it reads naturally.
- No generic filler ("precision", "premium", "excellence" as empty words). Every line should feel like a human who saw the content wrote it.
- Match each platform's culture: instagram = engaging hook + line break + relevant niche hashtags; tiktok = casual, punchy, trend-aware, a few hashtags; youtube = searchable title-style line, 2-3 tags; linkedin = a genuine professional insight, 0-2 hashtags; x = one sharp line; facebook = conversational; google_business = informative, zero hashtags.
- Hashtags describe the content and niche (what viewers would search), never the company.
- If content details are thin, lean on what IS known and keep it specific and human — short beats generic.

Respond with STRICT JSON only:
{"captions": [{"platform": "...", "text": "...", "hashtags": ["tag1"]}]}`;

type Rec = { platform: string; fit: string };

export async function generateCaptions(sb: SupabaseClient, assetId: string) {
  const { data: asset } = await sb
    .from("content_assets")
    .select("id,brand_id,type,title,description,transcript,duration_seconds")
    .eq("id", assetId)
    .single();
  if (!asset) throw new Error("Asset not found");

  const [{ data: brand }, { data: analysis }, trendBrief] = await Promise.all([
    sb.from("brands").select("name,tone_of_voice,target_audience").eq("id", asset.brand_id).single(),
    sb.from("analyses").select("platform_recommendations,summary").eq("asset_id", assetId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getFreshBrief(sb, asset.brand_id),
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
    asset.description ? `WHAT'S IN IT (from the creator): ${asset.description}` : ``,
    asset.transcript ? `WHAT'S SAID IN IT (transcript excerpt): ${asset.transcript.slice(0, 1500)}` : ``,
    analysis?.summary ? `AERA's read on it: ${analysis.summary}` : ``,
    trendBrief ? `THIS WEEK'S TREND BRIEF for the niche (use it — current styles, hashtags, formats): ${JSON.stringify(trendBrief.brief).slice(0, 2500)}` : ``,
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
