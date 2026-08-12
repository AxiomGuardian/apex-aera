import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText, activeModel } from "@/lib/ai/llm";

const SYSTEM = `You are AERA's reporting engine. Write a short executive summary (3-5 sentences) of a brand's content activity for the period, for a paying client. Plain language, warm but precise. ONLY reference the numbers provided — never invent metrics, results, or performance data that is not in the input. If activity is light, say so constructively.`;

export async function generateReport(sb: SupabaseClient, brandId: string) {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const [{ data: brand }, { data: assets }, { data: posts }, { data: analyses }] = await Promise.all([
    sb.from("brands").select("name,tone_of_voice").eq("id", brandId).single(),
    sb.from("content_assets").select("status,created_at").eq("brand_id", brandId),
    sb.from("scheduled_posts").select("status,platform,scheduled_at").eq("brand_id", brandId),
    sb.from("analyses").select("platform_recommendations,created_at").eq("brand_id", brandId).gte("created_at", since),
  ]);
  if (!brand) throw new Error("Brand not found");

  const assetCounts: Record<string, number> = {};
  for (const a of assets ?? []) assetCounts[a.status] = (assetCounts[a.status] ?? 0) + 1;
  const newAssets = (assets ?? []).filter((a) => a.created_at >= since).length;
  const postCounts: Record<string, number> = {};
  for (const p of posts ?? []) postCounts[p.status] = (postCounts[p.status] ?? 0) + 1;

  const platformStrength: Record<string, number> = {};
  for (const an of analyses ?? []) {
    for (const r of (an.platform_recommendations ?? []) as { platform: string; fit: string }[]) {
      if (r.fit === "strong") platformStrength[r.platform] = (platformStrength[r.platform] ?? 0) + 1;
    }
  }

  const data = {
    period_days: 7,
    new_assets: newAssets,
    assets_by_status: assetCounts,
    posts_by_status: postCounts,
    strongest_platforms: Object.entries(platformStrength).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([p]) => p),
    analyses_run: (analyses ?? []).length,
  };

  const summary = await completeText({
    system: SYSTEM,
    messages: [{ role: "user", content: `Brand: ${brand.name}\nActivity data (last 7 days):\n${JSON.stringify(data, null, 2)}` }],
    maxTokens: 500,
  });

  const { data: report, error } = await sb
    .from("reports")
    .insert({
      brand_id: brandId,
      type: "weekly_digest",
      summary: summary.trim(),
      data: { ...data, model: activeModel() },
      period_start: since.slice(0, 10),
      period_end: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return report;
}
