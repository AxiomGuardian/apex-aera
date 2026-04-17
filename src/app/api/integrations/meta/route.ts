// ─── Meta Ads Data Route ──────────────────────────────────────────────────────
// GET /api/integrations/meta
// Reads the user's Meta token from their encrypted cookie and returns live
// campaign data. Returns status "not_configured" when no token is present.

import { NextResponse } from "next/server";
import { getMetaToken } from "@/lib/integrations/tokenStore";
import { fetchMetaData } from "@/lib/integrations/fetchers";
import type { MetaAdsData, IntegrationApiResponse } from "@/lib/integrations/types";

const EMPTY: MetaAdsData = {
  platform: "meta", status: "not_configured",
  campaigns: [], audienceInsights: [],
  totalSpend: 0, totalRevenue: 0, totalRoas: 0,
  totalImpressions: 0, totalClicks: 0, totalConversions: 0,
  dateRange: "last_30_days",
};

export async function GET(): Promise<NextResponse<IntegrationApiResponse<MetaAdsData>>> {
  const token = await getMetaToken();

  if (!token) {
    return NextResponse.json({ success: true, data: EMPTY });
  }

  try {
    const data = await fetchMetaData(token);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Meta Ads] Error:", message);
    return NextResponse.json({
      success: false, error: message,
      data: { ...EMPTY, status: "error", errorMessage: message } as MetaAdsData,
    });
  }
}
