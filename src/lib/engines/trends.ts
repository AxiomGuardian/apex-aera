import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText } from "@/lib/ai/llm";
import { parseJson } from "./core";

/**
 * Trend Brief engine — weekly, per brand. Grok scours the live web and X
 * for what's working RIGHT NOW in this brand's niche, and stores a brief
 * the caption engine reads on every generation. Research once, use all week.
 */

const SYSTEM = `You are AERA's trend research engine. Using live web and X search, research what is working RIGHT NOW for this brand's niche on social platforms.

Research and report:
- Caption styles currently performing well in this niche (hooks, length, tone)
- Rising/currently-effective hashtags in the niche (NOT the brand's own name)
- Format notes per platform (what the algorithm favors this month)
- Hot topics or conversations in the niche worth riding this week

Be specific and current. Only report what your search actually supports — do not invent trends.

Respond with STRICT JSON only:
{
  "niche": "one-line description of the niche you researched",
  "summary": "3-4 sentence plain-language trend summary for this week",
  "platforms": {
    "instagram": {"caption_styles": ["..."], "hashtags": ["..."], "format_notes": "..."},
    "tiktok":    {"caption_styles": ["..."], "hashtags": ["..."], "format_notes": "..."},
    "youtube":   {"caption_styles": ["..."], "hashtags": ["..."], "format_notes": "..."},
    "linkedin":  {"caption_styles": ["..."], "hashtags": ["..."], "format_notes": "..."}
  },
  "hot_topics": ["..."]
}`;

export async function generateTrendBrief(sb: SupabaseClient, brandId: string) {
  const { data: brand } = await sb
    .from("brands")
    .select("name,tone_of_voice,target_audience,website_url")
    .eq("id", brandId)
    .single();
  if (!brand) throw new Error("Brand not found");

  const prompt = [
    `Brand: ${brand.name}`,
    `Tone of voice: ${brand.tone_of_voice ?? "not specified"}`,
    `Target audience: ${brand.target_audience ?? "not specified"}`,
    brand.website_url ? `Website: ${brand.website_url}` : ``,
    ``,
    `Research current social media trends for this brand's niche this week.`,
  ].filter(Boolean).join("\n");

  const raw = await completeText({
    system: SYSTEM,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 2000,
    liveSearch: true,
  });
  const brief = parseJson<{ niche?: string; summary?: string }>(raw);

  const { data, error } = await sb
    .from("trend_briefs")
    .insert({
      brand_id: brandId,
      niche: brief.niche ?? null,
      summary: brief.summary ?? null,
      brief,
      model: process.env.XAI_SEARCH_MODEL ?? (process.env.XAI_API_KEY ? "grok-4.6" : "claude-opus-4-8"),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Latest brief if it's fresh (≤ 8 days old), else null. */
export async function getFreshBrief(sb: SupabaseClient, brandId: string) {
  const { data } = await sb
    .from("trend_briefs")
    .select("summary,brief,created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const age = Date.now() - new Date(data.created_at).getTime();
  return age <= 8 * 24 * 3600 * 1000 ? data : null;
}
