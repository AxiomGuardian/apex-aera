// ─── Google Ads + YouTube Data Route ─────────────────────────────────────────
// GET /api/integrations/google
// Reads the user's Google token from their encrypted cookie and returns
// Google Ads campaign data. Also checks for YouTube channel data if configured.

import { NextResponse } from "next/server";
import { getGoogleToken } from "@/lib/integrations/tokenStore";
import { fetchGoogleAdsData, fetchYouTubeData, emptyYouTubeData } from "@/lib/integrations/fetchers";
import type { GoogleAdsData, YouTubeData, IntegrationApiResponse } from "@/lib/integrations/types";

export interface GoogleRouteResponse {
  google:  IntegrationApiResponse<GoogleAdsData>;
  youtube: IntegrationApiResponse<YouTubeData>;
}

const EMPTY_GOOGLE: GoogleAdsData = {
  platform: "google", status: "not_configured",
  campaigns: [], totalSpend: 0, totalRevenue: 0, totalRoas: 0,
  totalImpressions: 0, totalClicks: 0, totalConversions: 0,
  dateRange: "last_30_days",
};

export async function GET(): Promise<NextResponse<GoogleRouteResponse>> {
  const token = await getGoogleToken();

  if (!token) {
    return NextResponse.json({
      google:  { success: true, data: EMPTY_GOOGLE },
      youtube: { success: true, data: emptyYouTubeData("not_configured") },
    });
  }

  try {
    const googleData = await fetchGoogleAdsData(token);

    // YouTube: use YOUTUBE_CHANNEL_ID env var if set (optional)
    const channelId = process.env.YOUTUBE_CHANNEL_ID;
    let youtubeData: YouTubeData;
    if (channelId) {
      try {
        youtubeData = await fetchYouTubeData(token, channelId, googleData.campaigns);
      } catch {
        youtubeData = emptyYouTubeData("error", channelId);
      }
    } else {
      youtubeData = emptyYouTubeData("not_configured");
    }

    return NextResponse.json({
      google:  { success: true, data: googleData },
      youtube: { success: true, data: youtubeData },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Google Ads] Error:", message);
    return NextResponse.json({
      google: {
        success: false, error: message,
        data: { ...EMPTY_GOOGLE, status: "error" } as GoogleAdsData,
      },
      youtube: { success: false, data: emptyYouTubeData("error") },
    });
  }
}
