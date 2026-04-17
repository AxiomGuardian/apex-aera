// ─── AERA Integration Sync ────────────────────────────────────────────────────
// GET /api/integrations/sync
// Reads all platform tokens from the user's encrypted cookies, calls each
// platform's API in parallel, and returns a unified SyncData response.
//
// Calls fetcher functions directly — no internal HTTP chaining — so user
// cookies are always available in this server-side context.
//
// Marcus uses this to get live ad performance injected into his system prompt.
// The Integrations page uses this for connection status and metrics.

import { NextResponse } from "next/server";
import { getAllTokens, getConnectionStatuses } from "@/lib/integrations/tokenStore";
import {
  fetchMetaData,
  fetchGoogleAdsData,
  fetchYouTubeData,
  fetchLinkedInData,
  emptyYouTubeData,
} from "@/lib/integrations/fetchers";
import type {
  SyncData,
  MetaAdsData,
  GoogleAdsData,
  YouTubeData,
  LinkedInData,
  PlatformId,
  IntegrationApiResponse,
} from "@/lib/integrations/types";

// ─── Marcus Summary Builder ───────────────────────────────────────────────────

function buildMarcusSummary(sync: Omit<SyncData, "marcusSummary">): string {
  const { aggregate, platforms } = sync;

  if (aggregate.activePlatforms.length === 0) {
    return `No ad platforms are currently connected. When the client asks about campaign performance, ROAS, spend, or conversions, let them know that Marcus is ready to connect Meta Ads, Google Ads, YouTube Ads, or LinkedIn Ads — and direct them to the Integrations page to get started.`;
  }

  const fmt = (n: number, prefix = "$") =>
    `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  const fmtK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  const lines: string[] = [
    `## Live Ad Performance — Last 30 Days`,
    `Connected platforms: ${aggregate.activePlatforms.map((p) => p.toUpperCase()).join(", ")}`,
    `Total spend: ${fmt(aggregate.totalSpend)} | Revenue: ${fmt(aggregate.totalRevenue)} | Blended ROAS: ${aggregate.totalRoas.toFixed(2)}x`,
    `Impressions: ${fmtK(aggregate.totalImpressions)} | Clicks: ${fmtK(aggregate.totalClicks)} | Conversions: ${fmtK(aggregate.totalConversions)}`,
    ``,
  ];

  if (platforms.meta?.status === "connected") {
    const m = platforms.meta;
    lines.push(
      `### Meta Ads (${m.accountName ?? m.accountId})`,
      `Spend: ${fmt(m.totalSpend)} | ROAS: ${m.totalRoas.toFixed(2)}x | Conversions: ${m.totalConversions}`,
      `Active campaigns: ${m.campaigns.filter((c) => c.status === "ACTIVE").length} / ${m.campaigns.length} total`,
    );
    const top = [...m.campaigns].sort((a, b) => b.roas - a.roas).slice(0, 3);
    if (top.length) {
      lines.push(`Top campaigns by ROAS:`);
      top.forEach((c) => lines.push(`  - "${c.name}": ${c.roas.toFixed(2)}x ROAS, ${fmt(c.spend)} spend`));
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
    const top = [...g.campaigns].sort((a, b) => b.roas - a.roas).slice(0, 3);
    if (top.length) {
      lines.push(`Top campaigns by ROAS:`);
      top.forEach((c) => lines.push(`  - "${c.name}": ${c.roas.toFixed(2)}x ROAS, ${fmt(c.spend)} spend`));
    }
    lines.push("");
  }

  if (platforms.youtube?.status === "connected") {
    const y = platforms.youtube;
    lines.push(
      `### YouTube Ads`,
      `Spend: ${fmt(y.totalSpend)} | ROAS: ${y.totalRoas.toFixed(2)}x | Views: ${fmtK(y.totalViews)} | Watch time: ${fmtK(y.totalWatchTime)} min`,
      ``,
    );
  }

  if (platforms.linkedin?.status === "connected") {
    const l = platforms.linkedin;
    lines.push(
      `### LinkedIn Ads (${l.accountName ?? l.accountId})`,
      `Spend: ${fmt(l.totalSpend)} | ROAS: ${l.totalRoas.toFixed(2)}x | Conversions: ${l.totalConversions}`,
      `Campaigns: ${l.campaigns.filter((c) => c.status === "ACTIVE").length} active / ${l.campaigns.length} total`,
      ``,
    );
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
  // Fast path: check which platforms have tokens before making external API calls
  const statuses = await getConnectionStatuses();
  const tokens   = await getAllTokens();

  const activePlatforms: PlatformId[]    = [];
  const notConfigured:   PlatformId[]    = [];
  const allPlatforms:    PlatformId[]    = ["meta", "google", "youtube", "linkedin"];

  // Determine what's connected
  if (statuses.meta)     activePlatforms.push("meta");     else notConfigured.push("meta");
  if (statuses.google)   activePlatforms.push("google");   else notConfigured.push("google");
  if (statuses.google)   { /* youtube uses google token */ } else notConfigured.push("youtube");
  if (statuses.linkedin) activePlatforms.push("linkedin"); else notConfigured.push("linkedin");

  // Parallel fetch from connected platforms
  const [metaResult, googleResult, linkedinResult] = await Promise.allSettled([
    tokens.meta     ? fetchMetaData(tokens.meta)         : Promise.resolve(null),
    tokens.google   ? fetchGoogleAdsData(tokens.google)  : Promise.resolve(null),
    tokens.linkedin ? fetchLinkedInData(tokens.linkedin) : Promise.resolve(null),
  ]);

  const meta:    MetaAdsData | null = metaResult.status     === "fulfilled" ? metaResult.value     : null;
  const google:  GoogleAdsData | null = googleResult.status === "fulfilled" ? googleResult.value   : null;
  const linkedin: LinkedInData | null = linkedinResult.status === "fulfilled" ? linkedinResult.value : null;

  // YouTube uses Google token + optional channel ID
  let youtube: YouTubeData | null = null;
  if (tokens.google && google) {
    const channelId = process.env.YOUTUBE_CHANNEL_ID;
    if (channelId) {
      try {
        youtube = await fetchYouTubeData(tokens.google, channelId, google.campaigns);
        if (!activePlatforms.includes("youtube")) activePlatforms.push("youtube");
        const ytIdx = notConfigured.indexOf("youtube");
        if (ytIdx !== -1) notConfigured.splice(ytIdx, 1);
      } catch {
        youtube = emptyYouTubeData("error", channelId);
      }
    }
  }

  // Mark failed fetches as error status
  const metaData: MetaAdsData = meta ?? {
    platform: "meta", status: statuses.meta ? "error" : "not_configured",
    campaigns: [], audienceInsights: [], totalSpend: 0, totalRevenue: 0, totalRoas: 0,
    totalImpressions: 0, totalClicks: 0, totalConversions: 0, dateRange: "last_30_days",
  };
  const googleData: GoogleAdsData = google ?? {
    platform: "google", status: statuses.google ? "error" : "not_configured",
    campaigns: [], totalSpend: 0, totalRevenue: 0, totalRoas: 0,
    totalImpressions: 0, totalClicks: 0, totalConversions: 0, dateRange: "last_30_days",
  };
  const linkedinData: LinkedInData = linkedin ?? {
    platform: "linkedin", status: statuses.linkedin ? "error" : "not_configured",
    campaigns: [], totalSpend: 0, totalImpressions: 0,
    totalClicks: 0, totalConversions: 0, totalRoas: 0, dateRange: "last_30_days",
  };

  // Aggregate totals from active platforms only
  const connectedMeta     = metaData.status     === "connected";
  const connectedGoogle   = googleData.status   === "connected";
  const connectedYouTube  = youtube?.status     === "connected";
  const connectedLinkedIn = linkedinData.status === "connected";

  const sumSpend       = (connectedMeta     ? metaData.totalSpend     : 0)
                       + (connectedGoogle   ? googleData.totalSpend   : 0)
                       + (connectedYouTube  ? youtube!.totalSpend     : 0)
                       + (connectedLinkedIn ? linkedinData.totalSpend : 0);

  const sumRevenue     = (connectedMeta     ? metaData.totalRevenue           : 0)
                       + (connectedGoogle   ? googleData.totalRevenue         : 0)
                       + (connectedYouTube  ? youtube!.totalRoas * youtube!.totalSpend : 0)
                       + (connectedLinkedIn ? linkedinData.totalRoas * linkedinData.totalSpend : 0);

  const sumImpressions = (connectedMeta     ? metaData.totalImpressions     : 0)
                       + (connectedGoogle   ? googleData.totalImpressions   : 0)
                       + (connectedYouTube  ? youtube!.totalImpressions     : 0)
                       + (connectedLinkedIn ? linkedinData.totalImpressions : 0);

  const sumClicks      = (connectedMeta     ? metaData.totalClicks     : 0)
                       + (connectedGoogle   ? googleData.totalClicks   : 0)
                       + (connectedYouTube  ? youtube!.totalClicks     : 0)
                       + (connectedLinkedIn ? linkedinData.totalClicks : 0);

  const sumConversions = (connectedMeta     ? metaData.totalConversions     : 0)
                       + (connectedGoogle   ? googleData.totalConversions   : 0)
                       + (connectedYouTube  ? youtube!.totalConversions     : 0)
                       + (connectedLinkedIn ? linkedinData.totalConversions : 0);

  // Deduplicate platform lists
  const uniqueActive    = [...new Set(activePlatforms)];
  const uniqueNotConfig = allPlatforms.filter((p) => !uniqueActive.includes(p));

  const syncBase: Omit<SyncData, "marcusSummary"> = {
    syncedAt: new Date().toISOString(),
    platforms: {
      meta:     metaData,
      google:   googleData,
      youtube:  youtube ?? emptyYouTubeData("not_configured"),
      linkedin: linkedinData,
    },
    aggregate: {
      totalSpend:       parseFloat(sumSpend.toFixed(2)),
      totalRevenue:     parseFloat(sumRevenue.toFixed(2)),
      totalRoas:        sumSpend > 0 ? parseFloat((sumRevenue / sumSpend).toFixed(2)) : 0,
      totalImpressions: sumImpressions,
      totalClicks:      sumClicks,
      totalConversions: sumConversions,
      activePlatforms:  uniqueActive,
      notConfigured:    uniqueNotConfig,
    },
  };

  const syncData: SyncData = {
    ...syncBase,
    marcusSummary: buildMarcusSummary(syncBase),
  };

  return NextResponse.json({ success: true, data: syncData });
}
