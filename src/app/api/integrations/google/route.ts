// ─── Google Ads + YouTube Analytics Integration ───────────────────────────────
// Google Ads uses the Google Ads API (REST via googleads.googleapis.com).
// YouTube data is pulled from the YouTube Analytics API v2.
// Both share the same OAuth2 refresh token flow.
//
// Required env vars (add in Vercel → Settings → Environment Variables):
//   GOOGLE_ADS_CLIENT_ID         — OAuth2 client ID (from Google Cloud Console)
//   GOOGLE_ADS_CLIENT_SECRET     — OAuth2 client secret
//   GOOGLE_ADS_REFRESH_TOKEN     — Long-lived offline refresh token
//   GOOGLE_ADS_CUSTOMER_ID       — 10-digit customer ID (no dashes)
//   GOOGLE_ADS_DEVELOPER_TOKEN   — Developer token from Google Ads API Centre
//   YOUTUBE_CHANNEL_ID           — YouTube channel ID (optional; for Analytics)
//
// Note: YouTube ad campaign spend is surfaced through the same Google Ads
// customer account. The YouTube Analytics API provides view/watch-time data.

import { NextResponse } from "next/server";
import type {
  GoogleAdsData,
  YouTubeData,
  CampaignData,
  IntegrationApiResponse,
} from "@/lib/integrations/types";

// ─── OAuth2 Token Exchange ────────────────────────────────────────────────────

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.error_description ?? `Token refresh failed: ${res.status}`
    );
  }
  const json = await res.json();
  return json.access_token as string;
}

// ─── Google Ads API ───────────────────────────────────────────────────────────

const GOOGLE_ADS_API_VERSION = "v17";
const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

// GAQL query — last 30 days, campaign level
const CAMPAIGN_QUERY = `
  SELECT
    campaign.id,
    campaign.name,
    campaign.status,
    metrics.cost_micros,
    metrics.impressions,
    metrics.clicks,
    metrics.conversions,
    metrics.conversions_value,
    metrics.ctr,
    metrics.average_cpc,
    metrics.average_cpm
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND campaign.status != 'REMOVED'
  ORDER BY metrics.cost_micros DESC
  LIMIT 50
`.trim();

interface GaqlRow {
  campaign: { id: string; name: string; status: string };
  metrics: {
    cost_micros: string;
    impressions: string;
    clicks: string;
    conversions: string;
    conversions_value: string;
    ctr: string;
    average_cpc: string;
    average_cpm: string;
  };
}

async function fetchGoogleAdsData(
  accessToken: string,
  customerId: string,
  developerToken: string
): Promise<GoogleAdsData> {
  const cid = customerId.replace(/-/g, "");

  const res = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
        "Content-Type": "application/json",
        "login-customer-id": cid,
      },
      body: JSON.stringify({ query: CAMPAIGN_QUERY }),
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      body?.[0]?.error?.message ?? `Google Ads API error ${res.status}`;
    throw new Error(msg);
  }

  // searchStream returns a JSON array of result batches
  const batches: Array<{ results?: GaqlRow[] }> = await res.json();
  const rows: GaqlRow[] = batches.flatMap((b) => b.results ?? []);

  const campaigns: CampaignData[] = rows.map((row) => {
    const spend = parseInt(row.metrics.cost_micros, 10) / 1_000_000;
    const impressions = parseInt(row.metrics.impressions, 10) || 0;
    const clicks = parseInt(row.metrics.clicks, 10) || 0;
    const conversions = parseFloat(row.metrics.conversions) || 0;
    const revenue = parseFloat(row.metrics.conversions_value) || 0;
    const roas = spend > 0 ? revenue / spend : 0;

    type CS = CampaignData["status"];
    const statusMap: Record<string, CS> = {
      ENABLED: "ACTIVE",
      PAUSED: "PAUSED",
      ENDED: "COMPLETED",
    };

    return {
      id: row.campaign.id,
      name: row.campaign.name,
      status: (statusMap[row.campaign.status] ?? "UNKNOWN") as CS,
      spend: parseFloat(spend.toFixed(2)),
      impressions,
      clicks,
      conversions,
      revenue: parseFloat(revenue.toFixed(2)),
      roas: parseFloat(roas.toFixed(2)),
      ctr: parseFloat(row.metrics.ctr) * 100 || 0,
      cpc: parseInt(row.metrics.average_cpc, 10) / 1_000_000 || 0,
      cpm: parseInt(row.metrics.average_cpm, 10) / 1_000_000 || 0,
    };
  });

  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    platform: "google",
    status: "connected",
    customerId: cid,
    campaigns,
    totalSpend: parseFloat(totalSpend.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalRoas: parseFloat(totalRoas.toFixed(2)),
    totalImpressions,
    totalClicks,
    totalConversions,
    dateRange: "last_30_days",
  };
}

// ─── YouTube Analytics API ────────────────────────────────────────────────────

async function fetchYouTubeData(
  accessToken: string,
  channelId: string,
  googleCampaigns: CampaignData[]
): Promise<YouTubeData> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 86400 * 1000)
    .toISOString()
    .slice(0, 10);

  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.searchParams.set("ids", `channel==${channelId}`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate", endDate);
  url.searchParams.set("metrics", "views,estimatedMinutesWatched,impressions,clicks,conversions");
  url.searchParams.set("dimensions", "day");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    // YouTube Analytics is optional — return zeros rather than throwing
    return buildEmptyYouTubeData("connected", channelId, googleCampaigns);
  }

  const json = await res.json();
  const rows: number[][] = json.rows ?? [];

  let totalViews = 0,
    totalWatchTime = 0,
    totalImpressions = 0,
    totalClicks = 0,
    totalConversions = 0;

  for (const row of rows) {
    totalViews += row[1] ?? 0;
    totalWatchTime += row[2] ?? 0;
    totalImpressions += row[3] ?? 0;
    totalClicks += row[4] ?? 0;
    totalConversions += row[5] ?? 0;
  }

  // Filter YouTube video campaigns from Google Ads data
  const youtubeCampaigns = googleCampaigns.filter((c) =>
    c.name.toLowerCase().includes("youtube") ||
    c.name.toLowerCase().includes("video")
  );

  const totalSpend = youtubeCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = youtubeCampaigns.reduce((s, c) => s + c.revenue, 0);

  return {
    platform: "youtube",
    status: "connected",
    channelId,
    campaigns: youtubeCampaigns,
    totalViews,
    totalWatchTime,
    totalSpend: parseFloat(totalSpend.toFixed(2)),
    totalImpressions,
    totalClicks,
    totalConversions,
    totalRoas: totalSpend > 0 ? parseFloat((totalRevenue / totalSpend).toFixed(2)) : 0,
    dateRange: "last_30_days",
  };
}

function buildEmptyYouTubeData(
  status: YouTubeData["status"],
  channelId?: string,
  campaigns: CampaignData[] = []
): YouTubeData {
  return {
    platform: "youtube",
    status,
    channelId,
    campaigns,
    totalViews: 0,
    totalWatchTime: 0,
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalRoas: 0,
    dateRange: "last_30_days",
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export interface GoogleRouteResponse {
  google: IntegrationApiResponse<GoogleAdsData>;
  youtube: IntegrationApiResponse<YouTubeData>;
}

export async function GET(): Promise<NextResponse<GoogleRouteResponse>> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const youtubeChannelId = process.env.YOUTUBE_CHANNEL_ID;

  const adsConfigured =
    clientId && clientSecret && refreshToken && customerId && developerToken;

  if (!adsConfigured) {
    const notConfiguredGoogle: GoogleAdsData = {
      platform: "google",
      status: "not_configured",
      campaigns: [],
      totalSpend: 0,
      totalRevenue: 0,
      totalRoas: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      dateRange: "last_30_days",
    };
    return NextResponse.json({
      google: { success: true, data: notConfiguredGoogle },
      youtube: {
        success: true,
        data: buildEmptyYouTubeData("not_configured", youtubeChannelId),
      },
    });
  }

  try {
    const accessToken = await refreshAccessToken(
      clientId!,
      clientSecret!,
      refreshToken!
    );

    const googleData = await fetchGoogleAdsData(
      accessToken,
      customerId!,
      developerToken!
    );

    let youtubeData: YouTubeData;
    if (youtubeChannelId) {
      try {
        youtubeData = await fetchYouTubeData(
          accessToken,
          youtubeChannelId,
          googleData.campaigns
        );
      } catch {
        youtubeData = buildEmptyYouTubeData("error", youtubeChannelId, []);
      }
    } else {
      youtubeData = buildEmptyYouTubeData("not_configured");
    }

    return NextResponse.json({
      google: { success: true, data: googleData },
      youtube: { success: true, data: youtubeData },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Ads] Error:", message);

    const errorGoogle: GoogleAdsData = {
      platform: "google",
      status: "error",
      campaigns: [],
      totalSpend: 0,
      totalRevenue: 0,
      totalRoas: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      dateRange: "last_30_days",
    };

    return NextResponse.json({
      google: { success: false, error: message, data: errorGoogle },
      youtube: {
        success: false,
        data: buildEmptyYouTubeData("error"),
      },
    });
  }
}
