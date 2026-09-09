import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeText } from "@/lib/ai/llm";

/**
 * What APEX has done for a brand: month by month since they joined, with a
 * "before" baseline, real published counts, and platform numbers when the
 * metrics engine has them. GET ?brandId=...&months=3
 */
export const maxDuration = 30;

type Month = { key: string; label: string; uploaded: number; published: number; byPlatform: Record<string, number>; reach: number; engagement: number; views: number };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const brandId = url.searchParams.get("brandId");
  const months = Math.min(12, Math.max(1, Number(url.searchParams.get("months") ?? 3)));
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: brand } = await supabase.from("brands").select("id,name,created_at,baseline,baseline_captured_at,tone_of_voice,target_audience,website_url").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "No access to this brand" }, { status: 403 });

  const since = new Date(); since.setMonth(since.getMonth() - months + 1); since.setDate(1); since.setHours(0, 0, 0, 0);
  const [{ data: assets }, { data: posts }, { data: conns }, { data: metrics }, { data: events }] = await Promise.all([
    supabase.from("content_assets").select("created_at").eq("brand_id", brandId).gte("created_at", since.toISOString()),
    supabase.from("scheduled_posts").select("published_at,platform").eq("brand_id", brandId).eq("status", "published").gte("published_at", since.toISOString()),
    supabase.from("platform_connections").select("platform,status,account_name,connected_at").eq("brand_id", brandId),
    supabase.from("post_metrics").select("captured_at,platform,reach,impressions,likes,comments,shares,saves,views,followers").eq("brand_id", brandId).gte("captured_at", since.toISOString()),
    supabase.from("lifecycle_events").select("event,reason,created_at").eq("brand_id", brandId).order("created_at", { ascending: false }).limit(12),
  ]);

  const byMonth = new Map<string, Month>();
  for (let i = 0; i < months; i++) {
    const d = new Date(since); d.setMonth(since.getMonth() + i);
    const key = d.toISOString().slice(0, 7);
    byMonth.set(key, { key, label: d.toLocaleString("en-US", { month: "short", year: "numeric" }), uploaded: 0, published: 0, byPlatform: {}, reach: 0, engagement: 0, views: 0 });
  }
  const bucket = (iso: string | null) => (iso ? byMonth.get(iso.slice(0, 7)) : undefined);
  for (const a of assets ?? []) { const m = bucket(a.created_at); if (m) m.uploaded++; }
  for (const p of posts ?? []) { const m = bucket(p.published_at); if (m) { m.published++; m.byPlatform[p.platform] = (m.byPlatform[p.platform] ?? 0) + 1; } }
  for (const x of metrics ?? []) {
    const m = bucket(x.captured_at); if (!m) continue;
    m.reach += x.reach ?? x.impressions ?? 0; m.views += x.views ?? 0;
    m.engagement += (x.likes ?? 0) + (x.comments ?? 0) + (x.shares ?? 0) + (x.saves ?? 0);
  }
  const timeline = [...byMonth.values()];
  const totals = timeline.reduce((t, m) => ({ uploaded: t.uploaded + m.uploaded, published: t.published + m.published, reach: t.reach + m.reach, engagement: t.engagement + m.engagement, views: t.views + m.views }), { uploaded: 0, published: 0, reach: 0, engagement: 0, views: 0 });
  const latestFollowers: Record<string, number> = {};
  for (const x of (metrics ?? []).sort((a, b) => a.captured_at.localeCompare(b.captured_at))) if (x.followers != null) latestFollowers[x.platform] = x.followers;

  const baseline = (brand.baseline ?? {}) as { posts_per_month?: number; followers?: Record<string, number>; notes?: string };
  const hasMetrics = (metrics ?? []).length > 0;

  const facts = `Brand: ${brand.name}. Joined APEX ${brand.created_at.slice(0, 10)}.
Before APEX (baseline): ${baseline.posts_per_month != null ? baseline.posts_per_month + " posts per month" : "posting cadence not recorded"}; followers ${baseline.followers ? JSON.stringify(baseline.followers) : "not recorded"}. ${baseline.notes ?? ""}
Since then (${months} months): ${totals.uploaded} pieces of content uploaded, ${totals.published} posts published by AERA across ${Object.keys(timeline.reduce((acc, m) => ({ ...acc, ...m.byPlatform }), {})).join(", ") || "no platforms yet"}.
Platforms connected: ${(conns ?? []).filter((c) => c.status === "connected").map((c) => c.platform + " " + (c.account_name ?? "")).join(", ") || "none"}.
${hasMetrics ? `Reach ${totals.reach}, engagement ${totals.engagement}, views ${totals.views}. Followers now: ${JSON.stringify(latestFollowers)}.` : "Platform metrics are not being collected yet, so speak only to output and consistency, not reach."}
Month by month: ${timeline.map((m) => `${m.label}: ${m.published} published, ${m.uploaded} uploaded`).join("; ")}.`;

  const narrative = await completeText({
    system: "You are AERA writing a short review for the person who runs this brand about what APEX has done for them. Three to five plain sentences, warm and specific, no lists, no markdown, no em dashes. Only cite numbers given. If metrics are not collected yet, say the reach numbers arrive once the metrics engine is on and focus on consistency and output. End with one concrete recommendation for next month.",
    messages: [{ role: "user", content: facts }],
    maxTokens: 260,
  }).catch(() => "");

  return NextResponse.json({
    brand: { id: brand.id, name: brand.name, joined: brand.created_at },
    baseline, hasMetrics, timeline, totals, followers: latestFollowers,
    platforms: conns ?? [], recent: events ?? [], narrative: narrative.trim(),
  });
}
