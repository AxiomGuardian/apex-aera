// ─── AERA Integration Sync ────────────────────────────────────────────────────
// Aggregates data from all configured ad platforms (Meta, Google, YouTube,
// LinkedIn) into a single response that Marcus can use for real-time context.
//
// Called internally by the chat API route when Marcus context is needed,
// and externally by the Integrations dashboard to show connection status.
//
// GET /api/integrations/sync

import { NextResponse } from "next/server";
import type {
  SyncData,
  MetaAdsData,
  GoogleAdsData,
  YouTubeData,
  LinkedInData,
  PlatformId,
  IntegrationApiResponse,
} from "@/lib/integrations/types";

// ─── Internal fetch helpers ───────────────────────────────────────────────────
// We call our own API routes to keep all credentials/logic in one place.
// In production, use absolute URL from env; in dev, fall back to localhost.

function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

async function safeFetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${getBaseUrl()}${path}`, {
      next: { revalidate: 300 }, // cache 5 min
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

// ─── Marcus Summary Builder ───────────────────────────────────────────────────
// Produces a concise natural-language block injected into Marcus's system
// prompt so he can speak knowledgeably about live performance.

function buildMarcusSummary(sync: Omit<SyncData, "marcusSummary">): string {
  const { aggregate, platforms } = sync;

  if (aggregate.activePlatforms.length === 0) {
    return `No ad platforms are currently connected. When the client asks about campaign performance, ROAS, spend, or conversions, let them know that Marcus is ready to connect Meta Ads, Google Ads, YouTube Ads, or LinkedIn Ads — and direct them to the Integrations page to get started.`;
  }

  const fmt = (n: number, prefix = "$") =>
    `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const fmtK = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);

  const lines: string[] = [
    `## Live Ad Performance — Last 30 Days`,
    `Connected platforms: ${aggregate.activePlatforms.map((p) => p.toUpperCase()).join(", ")}`,
    `Total spend: ${fmt(aggregate.totalSpend)} | Revenue: ${fmt(aggregate.totalRevenue)} | Blended ROAS: ${aggregate.totalRoas.toFixed(2)}x`,
    `Impressions: ${fmtK(aggregate.totalImpressions)} | Clicks: ${fmtK(aggregate.totalClicks)} | Conversions: ${fmtK(aggregate.totalConversions)}`,
    ``,
  ];

  // Per-platform breakdown
  if (platforms.meta?.status === "connected") {
    const m = platforms.meta;
    lines.push(
      `### Meta Ads (${m.accountName ?? m.accountId})`,
      `Spend: ${fmt(m.totalSpend)} | ROAS: ${m.totalRoas.toFixed(2)}x | Conversions: ${m.totalConversions}`,
      `Active campaigns: ${m.campaigns.filter((c) => c.status === "ACTIVE").length} / ${m.campaigns.length} total`,
    );
    const topCampaigns = [...m.campaigns]
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 3);
    if (topCampaigns.length) {
      lines.push(`Top campaigns by ROAS:`);
      topCampaigns.forEach((c) =>
        lines.push(`  - "${c.name}": ${c.roas.toFixed(2)}x ROAS, ${fmt(c.spend)} spend`)
      );
    }
    lines.push("");
  }

  if (platforms.google?.status === "connected") {
    const g = platforms.google;
    lines.push(
      `### Google Ads (Customer: ${g.customerId})`,
      `Spend: ${fmt(g.totalSpend)} | ROAS: ${g.totalRoas.toFixed(2)}x | Conversions: ${g.totalConversions}`,
      `Campaigns: ${g.campaigns.filter((c) => c.status === "ACTIVE").length} active / ${g.campaigns.length} total`,
    );
    const topGoogle = [...g.campaigns]
      .sort((a, b) => b.roas - a.roas)
      .slice(0, 3);
    if (topGoogle.length) {
      lines.push(`Top campaigns by ROAS:`);
      topGoogle.forEach((c) =>
        lines.push(`  - "${c.name}": ${c.roas.toFixed(2)}x ROAS, ${fmt(c.spend)} spend`)
      );
    }
    lines.push("");
  }

  if (platforms.youtube?.status === "connected") {
    const y = platforms.youtube;
    lines.push(
      `### YouTube Ads`,
      `Spend: ${fmt(y.totalSpend)} | ROAS: ${y.totalRoas.toFixed(2)}x | Views: ${fmtK(y.totalViews)} | Watch time: ${fmtK(y.totalWatchTime)} min`,
    );
    lines.push("");
  }

  if (platforms.linkedin?.status === "connected") {
    const l = platforms.linkedin;
    lines.push(
      `### LinkedIn Ads (Account: ${l.accountId})`,
      `Spend: ${fmt(l.totalSpend)} | ROAS: ${l.totalRoas.toFixed(2)}x | Conversions: ${l.totalConversions}`,
      `Campaigns: ${l.campaigns.filter((c) => c.status === "ACTIVE").length} active / ${l.campaigns.length} total`,
    );
    lines.push("");
  }

  if (aggregate.notConfigured.length > 0) {
    lines.push(
      `Not yet connected: ${aggregate.notConfigured.map((p) => p.toUpperCase()).join(", ")}. ` +
      `Mention this when relevant — the client can connect these from the Integrations page.`
    );
  }

  lines.push(
    ``,
    `Use this data to give Marcus precise, data-forward recommendations. ` +
    `Reference specific campaigns, ROAS figures, and spend levels when advising on budget allocation or optimization.`
  );

  return lines.join("\n");
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<IntegrationApiResponse<SyncData>>> {
  const [metaResult, googleResult, linkedinResult] = await Promise.all([
    safeFetch<IntegrationApiResponse<MetaAdsData>>("/api/integrations/meta"),
    safeFetch<{ google: IntegrationApiResponse<GoogleAdsData>; youtube: IntegrationApiResponse<YouTubeData> }>(
      "/api/integrations/google"
    ),
    safeFetch<IntegrationApiResponse<LinkedInData>>("/api/integrations/linkedin"),
  ]);

  const meta = metaResult?.data;
  const google = googleResult?.google?.data;
  const youtube = googleResult?.youtube?.data;
  const linkedin = linkedinResult?.data;

  const activePlatforms: PlatformId[] = [];
  const notConfigured: PlatformId[] = [];

  if (meta?.status === "connected") activePlatforms.push("meta");
  else if (meta?.status === "not_configured") notConfigured.push("meta");

  if (google?.status === "connected") activePlatforms.push("google");
  else if (google?.status === "not_configured") notConfigured.push("google");

  if (youtube?.status === "connected") activePlatforms.push("youtube");
  else if (youtube?.status === "not_configured") notConfigured.push("youtube");

  if (linkedin?.status === "connected") activePlatforms.push("linkedin");
  else if (linkedin?.status === "not_configured") notConfigured.push("linkedin");

  // Default not-configured for all platforms when env vars are absent
  const allPlatforms: PlatformId[] = ["meta", "google", "youtube", "linkedin"];
  for (const p of allPlatforms) {
    if (!activePlatforms.includes(p) && !notConfigured.includes(p)) {
      notConfigured.push(p);
    }
  }

  // Aggregate cross-platform totals (only from active platforms)
  const sumSpend =
    (meta?.status === "connected" ? meta.totalSpend : 0) +
    (google?.status === "connected" ? google.totalSpend : 0) +
    (youtube?.status === "connected" ? youtube.totalSpend : 0) +
    (linkedin?.status === "connected" ? linkedin.totalSpend : 0);

  const sumRevenue =
    (meta?.status === "connected" ? meta.totalRevenue : 0) +
    (google?.status === "connected" ? google.totalRevenue : 0) +
    (youtube?.status === "connected" ? youtube.totalRoas * youtube.totalSpend : 0) +
    (linkedin?.status === "connected" ? linkedin.totalRoas * linkedin.totalSpend : 0);

  const sumImpressions =
    (meta?.status === "connected" ? meta.totalImpressions : 0) +
    (google?.status === "connected" ? google.totalImpressions : 0) +
    (youtube?.status === "connected" ? youtube.totalImpressions : 0) +
    (linkedin?.status === "connected" ? linkedin.totalImpressions : 0);

  const sumClicks =
    (meta?.status === "connected" ? meta.totalClicks : 0) +
    (google?.status === "connected" ? google.totalClicks : 0) +
    (youtube?.status === "connected" ? youtube.totalClicks : 0) +
    (linkedin?.status === "connected" ? linkedin.totalClicks : 0);

  const sumConversions =
    (meta?.status === "connected" ? meta.totalConversions : 0) +
    (google?.status === "connected" ? google.totalConversions : 0) +
    (youtube?.status === "connected" ? youtube.totalConversions : 0) +
    (linkedin?.status === "connected" ? linkedin.totalConversions : 0);

  const blendedRoas = sumSpend > 0 ? sumRevenue / sumSpend : 0;

  const syncBase: Omit<SyncData, "marcusSummary"> = {
    syncedAt: new Date().toISOString(),
    platforms: {
      meta: meta ?? undefined,
      google: google ?? undefined,
      youtube: youtube ?? undefined,
      linkedin: linkedin ?? undefined,
    },
    aggregate: {
      totalSpend: parseFloat(sumSpend.toFixed(2)),
      totalRevenue: parseFloat(sumRevenue.toFixed(2)),
      totalRoas: parseFloat(blendedRoas.toFixed(2)),
      totalImpressions: sumImpressions,
      totalClicks: sumClicks,
      totalConversions: sumConversions,
      activePlatforms,
      notConfigured,
    },
  };

  const syncData: SyncData = {
    ...syncBase,
    marcusSummary: buildMarcusSummary(syncBase),
  };

  return NextResponse.json({ success: true, data: syncData });
}
