// ─── LinkedIn Ads Data Route ──────────────────────────────────────────────────
// GET /api/integrations/linkedin
// Reads the user's LinkedIn token from their encrypted cookie and returns
// live campaign data.

import { NextResponse } from "next/server";
import { getLinkedInToken } from "@/lib/integrations/tokenStore";
import { fetchLinkedInData } from "@/lib/integrations/fetchers";
import type { LinkedInData, IntegrationApiResponse } from "@/lib/integrations/types";

const EMPTY: LinkedInData = {
  platform: "linkedin", status: "not_configured",
  campaigns: [], totalSpend: 0, totalImpressions: 0,
  totalClicks: 0, totalConversions: 0, totalRoas: 0,
  dateRange: "last_30_days",
};

export async function GET(): Promise<NextResponse<IntegrationApiResponse<LinkedInData>>> {
  const token = await getLinkedInToken();

  if (!token) {
    return NextResponse.json({ success: true, data: EMPTY });
  }

  try {
    const data = await fetchLinkedInData(token);
    return NextResponse.json({ success: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[LinkedIn Ads] Error:", message);
    return NextResponse.json({
      success: false, error: message,
      data: { ...EMPTY, status: "error", errorMessage: message } as LinkedInData,
    });
  }
}
