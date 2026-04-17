// ─── AERA Integration Fetchers ────────────────────────────────────────────────
// Pure functions that call external ad platform APIs.
// Takes token data directly — no env var reads, no cookie reads.
// Used by both the individual API routes and the sync aggregator.

import type {
  MetaAdsData,
  GoogleAdsData,
  YouTubeData,
  LinkedInData,
  CampaignData,
  AudienceInsight,
} from "./types";
import type { MetaTokenData, GoogleTokenData, LinkedInTokenData } from "./tokenStore";

// ─── Google OAuth2 token refresh ─────────────────────────────────────────────

export async function refreshGoogleAccessToken(token: GoogleTokenData): Promise<string> {
  // If access token is still valid (with 60s buffer), return it as-is
  if (token.expiresAt - 60_000 > Date.now()) return token.accessToken;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: token.refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error_description ?? `Token refresh failed: ${res.status}`);
  }
  const json = await res.json();
  return json.access_token as string;
}

// ─── Meta Ads ─────────────────────────────────────────────────────────────────

const META_API_VERSION = "v19.0";
const META_API_BASE    = `https://graph.facebook.com/${META_API_VERSION}`;
const DATE_PRESET      = "last_30_days";

interface MetaInsightNode {
  campaign_id: string; campaign_name: string;
  spend: string; impressions: string; clicks: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  ctr: string; cpc: string; cpm: string;
  date_start: string; date_stop: string;
}

interface MetaCampaignNode { id: string; name: string; status: string }

function extractActionValue(
  arr: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  const found = arr?.find((a) => a.action_type === type);
  return found ? parseFloat(found.value) : 0;
}

export async function fetchMetaData(token: MetaTokenData): Promise<MetaAdsData> {
  const { accessToken, accountId: rawId, accountName } = token;
  const adAccountId = rawId.startsWith("act_") ? rawId : `act_${rawId}`;

  const insightFields = [
    "campaign_id","campaign_name","spend","impressions","clicks",
    "actions","action_values","ctr","cpc","cpm","date_start","date_stop",
  ].join(",");

  const insightsUrl = new URL(`${META_API_BASE}/${adAccountId}/insights`);
  insightsUrl.searchParams.set("fields",      insightFields);
  insightsUrl.searchParams.set("date_preset", DATE_PRESET);
  insightsUrl.searchParams.set("level",       "campaign");
  insightsUrl.searchParams.set("limit",       "50");
  insightsUrl.searchParams.set("access_token", accessToken);

  const insightsRes = await fetch(insightsUrl.toString(), { next: { revalidate: 300 } });
  if (!insightsRes.ok) {
    const err = await insightsRes.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Meta API ${insightsRes.status}`);
  }
  const insightsJson = await insightsRes.json();
  const insights: MetaInsightNode[] = insightsJson.data ?? [];

  const campaignsUrl = new URL(`${META_API_BASE}/${adAccountId}/campaigns`);
  campaignsUrl.searchParams.set("fields", "id,name,status");
  campaignsUrl.searchParams.set("limit",  "100");
  campaignsUrl.searchParams.set("access_token", accessToken);
  const campaignsRes  = await fetch(campaignsUrl.toString(), { next: { revalidate: 300 } });
  const campaignsJson = await campaignsRes.json();
  const statusMap = new Map(
    ((campaignsJson.data ?? []) as MetaCampaignNode[]).map((c) => [c.id, c.status])
  );

  const campaigns: CampaignData[] = insights.map((row) => {
    const spend       = parseFloat(row.spend) || 0;
    const impressions = parseInt(row.impressions, 10) || 0;
    const clicks      = parseInt(row.clicks, 10) || 0;
    const conversions = extractActionValue(row.actions, "purchase");
    const revenue     = extractActionValue(row.action_values, "purchase");
    const roas        = spend > 0 ? revenue / spend : 0;
    type CS = CampaignData["status"];
    const sm: Record<string, CS> = { ACTIVE:"ACTIVE", PAUSED:"PAUSED", ARCHIVED:"COMPLETED", COMPLETED:"COMPLETED" };
    return {
      id: row.campaign_id, name: row.campaign_name,
      status: (sm[statusMap.get(row.campaign_id) ?? ""] ?? "UNKNOWN") as CS,
      spend: parseFloat(spend.toFixed(2)), impressions, clicks, conversions,
      revenue: parseFloat(revenue.toFixed(2)),
      roas: parseFloat(roas.toFixed(2)),
      ctr: parseFloat(row.ctr) || 0,
      cpc: parseFloat(row.cpc) || 0,
      cpm: parseFloat(row.cpm) || 0,
      startDate: row.date_start, endDate: row.date_stop,
    };
  });

  // Audience breakdown
  const audUrl = new URL(`${META_API_BASE}/${adAccountId}/insights`);
  audUrl.searchParams.set("fields",      "impressions,clicks,actions,action_values");
  audUrl.searchParams.set("date_preset", DATE_PRESET);
  audUrl.searchParams.set("breakdowns",  "age,gender");
  audUrl.searchParams.set("limit",       "20");
  audUrl.searchParams.set("access_token", accessToken);
  const audRes  = await fetch(audUrl.toString(), { next: { revalidate: 300 } });
  const audJson = await audRes.json();
  const audienceInsights: AudienceInsight[] = ((audJson.data ?? []) as Array<{
    age: string; gender: string; impressions: string; clicks: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  }>).slice(0, 10).map((row) => ({
    segment:     `${row.age} ${row.gender}`,
    impressions: parseInt(row.impressions, 10) || 0,
    clicks:      parseInt(row.clicks, 10) || 0,
    conversions: extractActionValue(row.actions, "purchase"),
    roas:        0,
  }));

  const totalSpend       = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue     = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks      = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  return {
    platform: "meta", status: "connected",
    accountId: adAccountId, accountName,
    campaigns, audienceInsights,
    totalSpend:       parseFloat(totalSpend.toFixed(2)),
    totalRevenue:     parseFloat(totalRevenue.toFixed(2)),
    totalRoas:        totalSpend > 0 ? parseFloat((totalRevenue / totalSpend).toFixed(2)) : 0,
    totalImpressions, totalClicks, totalConversions,
    dateRange: DATE_PRESET,
  };
}

// ─── Google Ads ───────────────────────────────────────────────────────────────

const GOOGLE_ADS_API_VERSION = "v17";
const GOOGLE_ADS_BASE        = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

const CAMPAIGN_QUERY = `
  SELECT
    campaign.id, campaign.name, campaign.status,
    metrics.cost_micros, metrics.impressions, metrics.clicks,
    metrics.conversions, metrics.conversions_value,
    metrics.ctr, metrics.average_cpc, metrics.average_cpm
  FROM campaign
  WHERE segments.date DURING LAST_30_DAYS
    AND campaign.status != 'REMOVED'
  ORDER BY metrics.cost_micros DESC
  LIMIT 50
`.trim();

interface GaqlRow {
  campaign: { id: string; name: string; status: string };
  metrics: {
    cost_micros: string; impressions: string; clicks: string;
    conversions: string; conversions_value: string;
    ctr: string; average_cpc: string; average_cpm: string;
  };
}

export async function fetchGoogleAdsData(token: GoogleTokenData): Promise<GoogleAdsData> {
  const accessToken = await refreshGoogleAccessToken(token);
  const cid         = token.customerId.replace(/-/g, "");

  const res = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${cid}/googleAds:searchStream`,
    {
      method: "POST",
      headers: {
        Authorization:          `Bearer ${accessToken}`,
        "developer-token":      token.developerToken,
        "Content-Type":         "application/json",
        "login-customer-id":    cid,
      },
      body: JSON.stringify({ query: CAMPAIGN_QUERY }),
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.[0]?.error?.message ?? `Google Ads API ${res.status}`);
  }

  const batches: Array<{ results?: GaqlRow[] }> = await res.json();
  const rows: GaqlRow[] = batches.flatMap((b) => b.results ?? []);

  const campaigns: CampaignData[] = rows.map((row) => {
    const spend       = parseInt(row.metrics.cost_micros, 10) / 1_000_000;
    const impressions = parseInt(row.metrics.impressions, 10) || 0;
    const clicks      = parseInt(row.metrics.clicks, 10) || 0;
    const conversions = parseFloat(row.metrics.conversions) || 0;
    const revenue     = parseFloat(row.metrics.conversions_value) || 0;
    type CS = CampaignData["status"];
    const sm: Record<string, CS> = { ENABLED:"ACTIVE", PAUSED:"PAUSED", ENDED:"COMPLETED" };
    return {
      id: row.campaign.id, name: row.campaign.name,
      status: (sm[row.campaign.status] ?? "UNKNOWN") as CS,
      spend:  parseFloat(spend.toFixed(2)), impressions, clicks, conversions,
      revenue: parseFloat(revenue.toFixed(2)),
      roas:   spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0,
      ctr:    (parseFloat(row.metrics.ctr) || 0) * 100,
      cpc:    parseInt(row.metrics.average_cpc, 10) / 1_000_000 || 0,
      cpm:    parseInt(row.metrics.average_cpm, 10) / 1_000_000 || 0,
    };
  });

  const totalSpend       = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue     = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks      = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);

  return {
    platform: "google", status: "connected", customerId: cid, campaigns,
    totalSpend:       parseFloat(totalSpend.toFixed(2)),
    totalRevenue:     parseFloat(totalRevenue.toFixed(2)),
    totalRoas:        totalSpend > 0 ? parseFloat((totalRevenue / totalSpend).toFixed(2)) : 0,
    totalImpressions, totalClicks, totalConversions,
    dateRange: "last_30_days",
  };
}

// ─── YouTube Analytics ────────────────────────────────────────────────────────

export async function fetchYouTubeData(
  token: GoogleTokenData,
  channelId: string,
  googleCampaigns: CampaignData[]
): Promise<YouTubeData> {
  const accessToken = await refreshGoogleAccessToken(token);
  const endDate     = new Date().toISOString().slice(0, 10);
  const startDate   = new Date(Date.now() - 30 * 86400 * 1000).toISOString().slice(0, 10);

  const url = new URL("https://youtubeanalytics.googleapis.com/v2/reports");
  url.searchParams.set("ids",       `channel==${channelId}`);
  url.searchParams.set("startDate", startDate);
  url.searchParams.set("endDate",   endDate);
  url.searchParams.set("metrics",   "views,estimatedMinutesWatched,impressions,clicks,conversions");
  url.searchParams.set("dimensions","day");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) return emptyYouTubeData("connected", channelId, []);

  const json  = await res.json();
  const rows: number[][] = json.rows ?? [];
  let totalViews = 0, totalWatchTime = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0;
  for (const row of rows) {
    totalViews        += row[1] ?? 0;
    totalWatchTime    += row[2] ?? 0;
    totalImpressions  += row[3] ?? 0;
    totalClicks       += row[4] ?? 0;
    totalConversions  += row[5] ?? 0;
  }

  const ytCampaigns  = googleCampaigns.filter(
    (c) => c.name.toLowerCase().includes("youtube") || c.name.toLowerCase().includes("video")
  );
  const totalSpend   = ytCampaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = ytCampaigns.reduce((s, c) => s + c.revenue, 0);

  return {
    platform: "youtube", status: "connected", channelId,
    campaigns: ytCampaigns, totalViews, totalWatchTime,
    totalSpend:       parseFloat(totalSpend.toFixed(2)),
    totalImpressions, totalClicks, totalConversions,
    totalRoas: totalSpend > 0 ? parseFloat((totalRevenue / totalSpend).toFixed(2)) : 0,
    dateRange: "last_30_days",
  };
}

export function emptyYouTubeData(
  status: YouTubeData["status"],
  channelId?: string,
  campaigns: CampaignData[] = []
): YouTubeData {
  return {
    platform: "youtube", status, channelId, campaigns,
    totalViews: 0, totalWatchTime: 0, totalSpend: 0,
    totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalRoas: 0,
    dateRange: "last_30_days",
  };
}

// ─── LinkedIn Ads ─────────────────────────────────────────────────────────────

const LI_API_BASE    = "https://api.linkedin.com/rest";
const LI_API_VERSION = "202401";

interface LiCampaign { id: number; name: string; status: string }
interface LiAnalyticsRow {
  pivotValues: string[];
  externalWebsiteConversions?: number;
  impressions?: number; clicks?: number;
  costInUsd?: number;
  conversionValueInLocalCurrency?: number;
}

export async function fetchLinkedInData(token: LinkedInTokenData): Promise<LinkedInData> {
  const { accessToken, accountId } = token;
  const sponsorUrn = `urn:li:sponsoredAccount:${accountId}`;
  const headers = {
    Authorization:                 `Bearer ${accessToken}`,
    "LinkedIn-Version":            LI_API_VERSION,
    "X-Restli-Protocol-Version":   "2.0.0",
  };

  const campaignUrl = new URL(`${LI_API_BASE}/adCampaigns`);
  campaignUrl.searchParams.set("q",                               "search");
  campaignUrl.searchParams.set("search.account.values[0]",        sponsorUrn);
  campaignUrl.searchParams.set("fields",                          "id,name,status,type");
  campaignUrl.searchParams.set("count",                           "50");

  const campaignsRes  = await fetch(campaignUrl.toString(), { headers, next: { revalidate: 300 } });
  if (!campaignsRes.ok) {
    const body = await campaignsRes.json().catch(() => ({}));
    throw new Error(body?.message ?? `LinkedIn campaigns API ${campaignsRes.status}`);
  }
  const campaignsJson = await campaignsRes.json();
  const campaigns: LiCampaign[] = campaignsJson.elements ?? [];

  if (!campaigns.length) {
    return { platform: "linkedin", status: "connected", accountId, accountName: token.accountName,
      campaigns: [], totalSpend: 0, totalImpressions: 0, totalClicks: 0,
      totalConversions: 0, totalRoas: 0, dateRange: "last_30_days" };
  }

  const endDate   = new Date();
  const startDate = new Date(Date.now() - 30 * 86400 * 1000);
  const analyticsUrl = new URL(`${LI_API_BASE}/adAnalytics`);
  analyticsUrl.searchParams.set("q",                    "analytics");
  analyticsUrl.searchParams.set("pivot",                "CAMPAIGN");
  analyticsUrl.searchParams.set("dateRange.start.day",  String(startDate.getDate()));
  analyticsUrl.searchParams.set("dateRange.start.month",String(startDate.getMonth() + 1));
  analyticsUrl.searchParams.set("dateRange.start.year", String(startDate.getFullYear()));
  analyticsUrl.searchParams.set("dateRange.end.day",    String(endDate.getDate()));
  analyticsUrl.searchParams.set("dateRange.end.month",  String(endDate.getMonth() + 1));
  analyticsUrl.searchParams.set("dateRange.end.year",   String(endDate.getFullYear()));
  analyticsUrl.searchParams.set("fields",
    "pivotValues,impressions,clicks,costInUsd,externalWebsiteConversions,conversionValueInLocalCurrency");
  analyticsUrl.searchParams.set("accounts[0]", sponsorUrn);

  const analyticsRes = await fetch(analyticsUrl.toString(), { headers, next: { revalidate: 300 } });
  const analyticsMap = new Map<string, LiAnalyticsRow>();
  if (analyticsRes.ok) {
    const j: { elements?: LiAnalyticsRow[] } = await analyticsRes.json();
    for (const el of (j.elements ?? [])) {
      const id = el.pivotValues?.[0]?.split(":").pop() ?? "";
      if (id) analyticsMap.set(id, el);
    }
  }

  type CS = CampaignData["status"];
  const sm: Record<string, CS> = {
    ACTIVE:"ACTIVE", PAUSED:"PAUSED", ARCHIVED:"COMPLETED", COMPLETED:"COMPLETED",
    CANCELLED:"COMPLETED", DRAFT:"PAUSED",
  };

  const campaignData: CampaignData[] = campaigns.map((c) => {
    const a = analyticsMap.get(String(c.id));
    const spend       = a?.costInUsd ?? 0;
    const impressions = a?.impressions ?? 0;
    const clicks      = a?.clicks ?? 0;
    const conversions = a?.externalWebsiteConversions ?? 0;
    const revenue     = parseFloat(String(a?.conversionValueInLocalCurrency ?? 0));
    return {
      id: String(c.id), name: c.name,
      status: (sm[c.status] ?? "UNKNOWN") as CS,
      spend: parseFloat(spend.toFixed(2)), impressions, clicks, conversions,
      revenue: parseFloat(revenue.toFixed(2)),
      roas:    spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0,
      ctr:     impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
      cpc:     clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0,
      cpm:     impressions > 0 ? parseFloat(((spend / impressions) * 1000).toFixed(2)) : 0,
    };
  });

  const totalSpend       = campaignData.reduce((s, c) => s + c.spend, 0);
  const totalRevenue     = campaignData.reduce((s, c) => s + c.revenue, 0);
  const totalImpressions = campaignData.reduce((s, c) => s + c.impressions, 0);
  const totalClicks      = campaignData.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = campaignData.reduce((s, c) => s + c.conversions, 0);

  return {
    platform: "linkedin", status: "connected",
    accountId, accountName: token.accountName,
    campaigns: campaignData,
    totalSpend:       parseFloat(totalSpend.toFixed(2)),
    totalImpressions, totalClicks, totalConversions,
    totalRoas: totalSpend > 0 ? parseFloat((totalRevenue / totalSpend).toFixed(2)) : 0,
    dateRange: "last_30_days",
  };
}
