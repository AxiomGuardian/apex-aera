// ─── Meta Ads OAuth — Step 1: Initiate ───────────────────────────────────────
// GET /api/integrations/connect/meta
// Redirects the user to Meta's OAuth consent screen.
//
// Required env vars (APEX developer app — set once in Vercel):
//   META_APP_ID      — From developers.facebook.com → Your App → App ID
//   META_APP_SECRET  — From developers.facebook.com → Your App → App Secret
//
// Register this callback URL in your Meta App:
//   Facebook Login → Settings → Valid OAuth Redirect URIs:
//   https://apexaera.com/api/integrations/connect/meta/callback

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function GET(): Promise<NextResponse> {
  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.redirect(
      `${getAppUrl()}/integrations?error=meta_not_configured`
    );
  }

  // CSRF state token — verified in callback
  const state = randomBytes(16).toString("hex");
  const jar   = await cookies();
  jar.set("apex_oauth_state_meta", state, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/",
    maxAge:   600, // 10 min
  });

  const scopes = ["ads_read", "business_management"].join(",");
  const redirectUri = `${getAppUrl()}/api/integrations/connect/meta/callback`;

  const oauthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id",     appId);
  oauthUrl.searchParams.set("redirect_uri",  redirectUri);
  oauthUrl.searchParams.set("scope",         scopes);
  oauthUrl.searchParams.set("state",         state);
  oauthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(oauthUrl.toString());
}

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL)          return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
