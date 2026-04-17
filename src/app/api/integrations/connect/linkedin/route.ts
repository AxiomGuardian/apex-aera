// ─── LinkedIn Ads OAuth — Step 1: Initiate ───────────────────────────────────
// GET /api/integrations/connect/linkedin
// Redirects to LinkedIn's OAuth consent screen.
//
// Required env vars (APEX developer app — set once in Vercel):
//   LINKEDIN_CLIENT_ID     — LinkedIn Developer Portal → App → Client ID
//   LINKEDIN_CLIENT_SECRET — LinkedIn Developer Portal → App → Client Secret
//
// Register callback in LinkedIn Developer Portal:
//   Products → Marketing Developer Platform → OAuth 2.0 settings → Redirect URLs:
//   https://apexaera.com/api/integrations/connect/linkedin/callback

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL)          return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(): Promise<NextResponse> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${getAppUrl()}/integrations?error=linkedin_not_configured`);
  }

  const state = randomBytes(16).toString("hex");
  const jar   = await cookies();
  jar.set("apex_oauth_state_linkedin", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   600,
  });

  const redirectUri = `${getAppUrl()}/api/integrations/connect/linkedin/callback`;

  // r_ads: read ad performance, r_ads_reporting: read reports
  const scopes = ["r_ads", "r_ads_reporting"].join(" ");

  const oauthUrl = new URL("https://www.linkedin.com/oauth/v2/authorization");
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("client_id",     clientId);
  oauthUrl.searchParams.set("redirect_uri",  redirectUri);
  oauthUrl.searchParams.set("state",         state);
  oauthUrl.searchParams.set("scope",         scopes);

  return NextResponse.redirect(oauthUrl.toString());
}
