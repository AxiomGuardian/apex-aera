// ─── Meta Ads API Integration ─────────────────────────────────────────────────
// Reads META_ADS_ACCESS_TOKEN and META_ADS_ACCOUNT_ID from env.
// When credentials are present, calls the Meta Marketing API v19.0.
// When absent, returns status "not_configured" so the UI can prompt
// the user to connect rather than showing an error.
//
// Required env vars (add in Vercel → Settings → Environment Variables):
//   META_ADS_ACCESS_TOKEN  — Long-lived user or system-user access token
//   META_ADS_ACCOUNT_ID    — Ad account ID, format: act_XXXXXXXXXX

import { NextResponse } from "next/server";
import type {
  MetaAdsData,
  CampaignData,
  AudienceInsight,
  IntegrationApiResponse,
} from "@/lib/integrations/types";

const META_API_VERSION = "v19.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

const DATE_PRESET = "last_30_days";

interface MetaInsightNode {
  campaign_id: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  ctr: string;
  cpc: string;
  cpm: string;
  date_start: string;
  date_stop: string;
}

interface MetaCampaignNode {
  id: string;
  name: string;
  status: string;
}

function extractActionValue(
  arr: Array<{ action_type: string; value: string }> | undefined,
  type: string
): number {
  const found = arr?.find((a) => a.action_type === type);
  return found ? parseFloat(found.value) : 0;
}

async function fetchMetaData(
  accessToken: string,
  accountId: string
): Promise<MetaAdsData> {
  // Normalize account ID
  const adAccountId = accountId.startsWith("act_")
    ? accountId
    : `act_${accountId}`;

  // ── 1. Fetch campaign insights ────────────────────────────────────────────
  const insightFields = [
    "campaign_id",
    "campaign_name",
    "spend",
    "impressions",
    "clicks",
    "actions",
    "action_values",
    "ctr",
    "cpc",
    "cpm",
    "date_start",
    "date_stop",
  ].join(",");

  const insightsUrl = new URL(`${META_API_BASE}/${adAccountId}/insights`);
  insightsUrl.searchParams.set("fields", insightFields);
  insightsUrl.searchParams.set("date_preset", DATE_PRESET);
  insightsUrl.searchParams.set("level", "campaign");
  insightsUrl.searchParams.set("limit", "50");
  insightsUrl.searchParams.set("access_token", accessToken);

  const insightsRes = await fetch(insightsUrl.toString(), {
    next: { revalidate: 300 }, // cache 5 min
  });

  if (!insightsRes.ok) {
    const errBody = await insightsRes.json().catch(() => ({}));
    throw new Error(
      errBody?.error?.message ?? `Meta API error ${insightsRes.status}`
    );
  }

  const insightsJson = await insightsRes.json();
  const insights: MetaInsightNode[] = insightsJson.data ?? [];

  // ── 2. Fetch campaign statuses ────────────────────────────────────────────
  const campaignsUrl = new URL(`${META_API_BASE}/${adAccountId}/campaigns`);
  campaignsUrl.searchParams.set("fields", "id,name,status");
  campaignsUrl.searchParams.set("limit", "100");
  campaignsUrl.searchParams.set("access_token", accessToken);

  const campaignsRes = await fetch(campaignsUrl.toString(), {
    next: { revalidate: 300 },
  });
  const campaignsJson = await campaignsRes.json();
  const campaignNodes: MetaCampaignNode[] = campaignsJson.data ?? [];
  const statusMap = new Map(campaignNodes.map((c) => [c.id, c.status]));

  // ── 3. Build campaign data ────────────────────────────────────────────────
  const campaigns: CampaignData[] = insights.map((row) => {
    const spend = parseFloat(row.spend) || 0;
    const impressions = parseInt(row.impressions, 10) || 0;
    const clicks = parseInt(row.clicks, 10) || 0;
    const conversions = extractActionValue(row.actions, "purchase");
    const revenue = extractActionValue(row.action_values, "purchase");
    const roas = spend > 0 ? revenue / spend : 0;

    const rawStatus = statusMap.get(row.campaign_id) ?? "UNKNOWN";
    type CS = CampaignData["status"];
    const statusMap2: Record<string, CS> = {
      ACTIVE: "ACTIVE",
      PAUSED: "PAUSED",
      ARCHIVED: "COMPLETED",
      COMPLETED: "COMPLETED",
    };

    return {
      id: row.campaign_id,
      name: row.campaign_name,
      status: (statusMap2[rawStatus] ?? "UNKNOWN") as CS,
      spend,
      impressions,
      clicks,
      conversions,
      revenue,
      roas: parseFloat(roas.toFixed(2)),
      ctr: parseFloat(row.ctr) || 0,
      cpc: parseFloat(row.cpc) || 0,
      cpm: parseFloat(row.cpm) || 0,
      startDate: row.date_start,
      endDate: row.date_stop,
    };
  });

  // ── 4. Aggregate totals ───────────────────────────────────────────────────
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const totalImpressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;

  // ── 5. Audience insights (top breakdown by age/gender) ────────────────────
  const audienceUrl = new URL(`${META_API_BASE}/${adAccountId}/insights`);
  audienceUrl.searchParams.set(
    "fields",
    "impressions,clicks,actions,action_values"
  );
  audienceUrl.searchParams.set("date_preset", DATE_PRESET);
  audienceUrl.searchParams.set("breakdowns", "age,gender");
  audienceUrl.searchParams.set("limit", "20");
  audienceUrl.searchParams.set("access_token", accessToken);

  const audienceRes = await fetch(audienceUrl.toString(), {
    next: { revalidate: 300 },
  });
  const audienceJson = await audienceRes.json();
  const audienceRaw: Array<{
    age: string;
    gender: string;
    impressions: string;
    clicks: string;
    actions?: Array<{ action_type: string; value: string }>;
    action_values?: Array<{ action_type: string; value: string }>;
  }> = audienceJson.data ?? [];

  const audienceInsights: AudienceInsight[] = audienceRaw
    .slice(0, 10)
    .map((row) => {
      const spend = 0; // not returned at breakdown level without cost_per_action_type
      const conversions = extractActionValue(row.actions, "purchase");
      const revenue = extractActionValue(row.action_values, "purchase");
      return {
        segment: `${row.age} ${row.gender}`,
        impressions: parseInt(row.impressions, 10) || 0,
        clicks: parseInt(row.clicks, 10) || 0,
        conversions,
        roas: spend > 0 ? revenue / spend : 0,
      };
    });

  // ── 6. Account name ───────────────────────────────────────────────────────
  const acctUrl = new URL(`${META_API_BASE}/${adAccountId}`);
  acctUrl.searchParams.set("fields", "id,name");
  acctUrl.searchParams.set("access_token", accessToken);
  const acctRes = await fetch(acctUrl.toString(), {
    next: { revalidate: 3600 },
  });
  const acctJson = await acctRes.json();

  return {
    platform: "meta",
    status: "connected",
    accountId: adAccountId,
    accountName: acctJson.name ?? adAccountId,
    campaigns,
    audienceInsights,
    totalSpend: parseFloat(totalSpend.toFixed(2)),
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalRoas: parseFloat(totalRoas.toFixed(2)),
    totalImpressions,
    totalClicks,
    totalConversions,
    dateRange: DATE_PRESET,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<
  NextResponse<IntegrationApiResponse<MetaAdsData>>
> {
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;
  const accountId = process.env.META_ADS_ACCOUNT_ID;

  if (!accessToken || !accountId) {
    return NextResponse.json({
      success: true,
      data: {
        platform: "meta",
        status: "not_configured",
        campaigns: [],
        audienceInsights: [],
        totalSpend: 0,
        totalRevenue: 0,
        totalRoas: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        dateRange: DATE_PRESET,
      },
    });
  }

  try {
    const data = await fetchMetaData(accessToken, accountId);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Meta Ads] Error:", message);
    return NextResponse.json(
      {
        success: false,
        error: message,
        data: {
          platform: "meta",
          status: "error",
          errorMessage: message,
          campaigns: [],
          audienceInsights: [],
          totalSpend: 0,
          totalRevenue: 0,
          totalRoas: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalConversions: 0,
          dateRange: DATE_PRESET,
        },
      },
      { status: 200 } // 200 so the client can read the error body
    );
  }
}
