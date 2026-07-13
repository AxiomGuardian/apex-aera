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

export async function GET(request: Request): Promise<NextResponse> {
  // Always derive base URL from the actual request origin so error redirects
  // stay on the same domain the user is on (avoids cross-domain session loss).
  // For the OAuth callback URI we prefer NEXT_PUBLIC_APP_URL if set (stable
  // production domain); otherwise fall back to the request origin.
  const requestOrigin = new URL(request.url).origin;
  const callbackBase  = process.env.NEXT_PUBLIC_APP_URL ?? requestOrigin;

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.redirect(`${requestOrigin}/integrations?error=meta_not_configured`);
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

  const scopes      = ["ads_read", "business_management"].join(",");
  const redirectUri = `${callbackBase}/api/integrations/connect/meta/callback`;

  const oauthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id",     appId);
  oauthUrl.searchParams.set("redirect_uri",  redirectUri);
  oauthUrl.searchParams.set("scope",         scopes);
  oauthUrl.searchParams.set("state",         state);
  oauthUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(oauthUrl.toString());
}
