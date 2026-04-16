// ─── LinkedIn Marketing API Integration ──────────────────────────────────────
// Uses LinkedIn Marketing Solutions API v202401 (Campaign Manager).
// Auth: OAuth2 3-legged flow (same refresh token pattern as Google).
//
// Required env vars (add in Vercel → Settings → Environment Variables):
//   LINKEDIN_CLIENT_ID           — From LinkedIn Developer App
//   LINKEDIN_CLIENT_SECRET       — From LinkedIn Developer App
//   LINKEDIN_REFRESH_TOKEN       — Long-lived (60-day) OAuth2 refresh token
//   LINKEDIN_AD_ACCOUNT_ID       — Sponsor account URN ID (numbers only)

import { NextResponse } from "next/server";
import type {
  LinkedInData,
  CampaignData,
  IntegrationApiResponse,
} from "@/lib/integrations/types";

const LI_API_BASE = "https://api.linkedin.com/rest";
const LI_API_VERSION = "202401";

// ─── OAuth2 Token Refresh ─────────────────────────────────────────────────────

async function refreshLinkedInToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body?.error_description ?? `LinkedIn token refresh failed: ${res.status}`
    );
  }
  const json = await res.json();
  return json.access_token as string;
}

// ─── LinkedIn API Helpers ─────────────────────────────────────────────────────

interface LiCampaign {
  id: number;
  name: string;
  status: string; // ACTIVE | PAUSED | ARCHIVED | COMPLETED | CANCELLED | DRAFT
  type: string;
}

interface LiAnalytics {
  pivotValues: string[];
  externalWebsiteConversions?: number;
  externalWebsitePostClickConversions?: number;
  impressions?: number;
  clicks?: number;
  costInUsd?: number;
  conversionValueInLocalCurrency?: number;
}

async function fetchLinkedInData(
  accessToken: string,
  accountId: string
): Promise<LinkedInData> {
  const sponsorAccountUrn = `urn:li:sponsoredAccount:${accountId}`;

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": LI_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };

  // ── 1. Fetch campaigns ────────────────────────────────────────────────────
  const campaignUrl = new URL(`${LI_API_BASE}/adCampaigns`);
  campaignUrl.searchParams.set("q", "search");
  campaignUrl.searchParams.set(
    "search.account.values[0]",
    sponsorAccountUrn
  );
  campaignUrl.searchParams.set("fields", "id,name,status,type");
  campaignUrl.searchParams.set("count", "50");

  const campaignsRes = await fetch(campaignUrl.toString(), {
    headers,
    next: { revalidate: 300 },
  });
  if (!campaignsRes.ok) {
    const body = await campaignsRes.json().catch(() => ({}));
    throw new Error(
      body?.message ?? `LinkedIn campaigns API error ${campaignsRes.status}`
    );
  }
  const campaignsJson = await campaignsRes.json();
  const campaigns: LiCampaign[] = (campaignsJson.elements ?? []) as LiCampaign[];

  if (campaigns.length === 0) {
    return {
      platform: "linkedin",
      status: "connected",
      accountId,
      campaigns: [],
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalRoas: 0,
      dateRange: "last_30_days",
    };
  }

  // ── 2. Fetch analytics ────────────────────────────────────────────────────
  const endDate = new Date();
  const startDate = new Date(Date.now() - 30 * 86400 * 1000);

  const analyticsUrl = new URL(`${LI_API_BASE}/adAnalytics`);
  analyticsUrl.searchParams.set("q", "analytics");
  analyticsUrl.searchParams.set("pivot", "CAMPAIGN");
  analyticsUrl.searchParams.set(
    "dateRange.start.day",
    String(startDate.getDate())
  );
  analyticsUrl.searchParams.set(
    "dateRange.start.month",
    String(startDate.getMonth() + 1)
  );
  analyticsUrl.searchParams.set(
    "dateRange.start.year",
    String(startDate.getFullYear())
  );
  analyticsUrl.searchParams.set("dateRange.end.day", String(endDate.getDate()));
  analyticsUrl.searchParams.set(
    "dateRange.end.month",
    String(endDate.getMonth() + 1)
  );
  analyticsUrl.searchParams.set(
    "dateRange.end.year",
    String(endDate.getFullYear())
  );
  analyticsUrl.searchParams.set(
    "fields",
    "pivotValues,impressions,clicks,costInUsd,externalWebsiteConversions,conversionValueInLocalCurrency"
  );
  analyticsUrl.searchParams.set(
    "accounts[0]",
    sponsorAccountUrn
  );

  const analyticsRes = await fetch(analyticsUrl.toString(), {
    headers,
    next: { revalidate: 300 },
  });

  const analyticsMap = new Map<string, LiAnalytics>();
  if (analyticsRes.ok) {
    const analyticsJson = await analyticsRes.json();
    const elements: LiAnalytics[] = analyticsJson.elements ?? [];
    for (const el of elements) {
      const campaignId = el.pivotValues?.[0]?.split(":").pop() ?? "";
      if (campaignId) analyticsMap.set(campaignId, el);
    }
  }

  // ── 3. Build campaign data ────────────────────────────────────────────────
  type CS = CampaignData["status"];
  const statusMap: Record<string, CS> = {
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
    ARCHIVED: "COMPLETED",
    COMPLETED: "COMPLETED",
    CANCELLED: "COMPLETED",
    DRAFT: "PAUSED",
  };

  const campaignData: CampaignData[] = campaigns.map((c) => {
    const analytics = analyticsMap.get(String(c.id));
    const spend = analytics?.costInUsd ?? 0;
    const impressions = analytics?.impressions ?? 0;
    const clicks = analytics?.clicks ?? 0;
    const conversions = analytics?.externalWebsiteConversions ?? 0;
    const revenue = parseFloat(
      String(analytics?.conversionValueInLocalCurrency ?? 0)
    );
    const roas = spend > 0 ? revenue / spend : 0;

    return {
      id: String(c.id),
      name: c.name,
      status: (statusMap[c.status] ?? "UNKNOWN") as CS,
      spend: parseFloat(spend.toFixed(2)),
      impressions,
      clicks,
      conversions,
      revenue: parseFloat(revenue.toFixed(2)),
      roas: parseFloat(roas.toFixed(2)),
      ctr: impressions > 0 ? parseFloat(((clicks / impressions) * 100).toFixed(2)) : 0,
      cpc: clicks > 0 ? parseFloat((spend / clicks).toFixed(2)) : 0,
      cpm: impressions > 0 ? parseFloat(((spend / impressions) * 1000).toFixed(2)) : 0,
    };
  });

  const totalSpend = campaignData.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaignData.reduce((s, c) => s + c.revenue, 0);
  const totalImpressions = campaignData.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaignData.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = campaignData.reduce((s, c) => s + c.conversions, 0);
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  return {
    platform: "linkedin",
    status: "connected",
    accountId,
    campaigns: campaignData,
    totalSpend: parseFloat(totalSpend.toFixed(2)),
    totalImpressions,
    totalClicks,
    totalConversions,
    totalRoas: parseFloat(totalRoas.toFixed(2)),
    dateRange: "last_30_days",
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<
  NextResponse<IntegrationApiResponse<LinkedInData>>
> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
  const accountId = process.env.LINKEDIN_AD_ACCOUNT_ID;

  const notConfigured: LinkedInData = {
    platform: "linkedin",
    status: "not_configured",
    campaigns: [],
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalRoas: 0,
    dateRange: "last_30_days",
  };

  if (!clientId || !clientSecret || !refreshToken || !accountId) {
    return NextResponse.json({ success: true, data: notConfigured });
  }

  try {
    const accessToken = await refreshLinkedInToken(
      clientId,
      clientSecret,
      refreshToken
    );
    const data = await fetchLinkedInData(accessToken, accountId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[LinkedIn Ads] Error:", message);
    return NextResponse.json({
      success: false,
      error: message,
      data: {
        ...notConfigured,
        status: "error",
        errorMessage: message,
      },
    });
  }
}
