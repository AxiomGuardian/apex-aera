// ─── Google Ads OAuth — Step 1: Initiate ─────────────────────────────────────
// GET /api/integrations/connect/google
// Redirects to Google's OAuth consent screen requesting Ads + YouTube scopes.
//
// Required env vars (APEX developer credentials — set once in Vercel):
//   GOOGLE_ADS_CLIENT_ID       — Google Cloud Console → OAuth 2.0 Client ID
//   GOOGLE_ADS_CLIENT_SECRET   — Google Cloud Console → OAuth 2.0 Client Secret
//   GOOGLE_ADS_DEVELOPER_TOKEN — Google Ads API Center → Developer Token
//
// Register this callback URL in Google Cloud Console:
//   APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs:
//   https://apexaera.com/api/integrations/connect/google/callback

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL)          return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${getAppUrl()}/integrations?error=google_not_configured`);
  }

  const state = randomBytes(16).toString("hex");
  const jar   = await cookies();
  jar.set("apex_oauth_state_google", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   600,
  });

  const redirectUri = `${getAppUrl()}/api/integrations/connect/google/callback`;

  // Request Google Ads + YouTube Analytics scopes (offline for refresh token)
  const scopes = [
    "https://www.googleapis.com/auth/adwords",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
  ].join(" ");

  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id",     clientId);
  oauthUrl.searchParams.set("redirect_uri",  redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope",         scopes);
  oauthUrl.searchParams.set("state",         state);
  oauthUrl.searchParams.set("access_type",   "offline");   // gets refresh token
  oauthUrl.searchParams.set("prompt",        "consent");   // force consent to always get refresh token

  return NextResponse.redirect(oauthUrl.toString());
}
