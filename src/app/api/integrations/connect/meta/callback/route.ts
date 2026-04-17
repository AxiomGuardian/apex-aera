// ─── Meta Ads OAuth — Step 2: Callback ───────────────────────────────────────
// GET /api/integrations/connect/meta/callback?code=...&state=...
// Exchanges the authorization code for tokens, fetches the user's ad account,
// stores everything in an encrypted HttpOnly cookie, redirects to /integrations.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setMetaToken } from "@/lib/integrations/tokenStore";

const META_API_VERSION = "v19.0";
const META_API_BASE    = `https://graph.facebook.com/${META_API_VERSION}`;

function getAppUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL)          return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(request: Request): Promise<NextResponse> {
  const url       = new URL(request.url);
  const code      = url.searchParams.get("code");
  const state     = url.searchParams.get("state");
  const errorCode = url.searchParams.get("error");

  const appUrl = getAppUrl();

  // ── 1. User denied / error from Meta ─────────────────────────────────────
  if (errorCode) {
    return NextResponse.redirect(`${appUrl}/integrations?error=meta_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=meta_invalid`);
  }

  // ── 2. Verify CSRF state ──────────────────────────────────────────────────
  const jar         = await cookies();
  const savedState  = jar.get("apex_oauth_state_meta")?.value;
  jar.set("apex_oauth_state_meta", "", { maxAge: 0, path: "/" });

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=meta_csrf`);
  }

  const appId     = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = `${appUrl}/api/integrations/connect/meta/callback`;

  // ── 3. Exchange code for short-lived access token ─────────────────────────
  const tokenUrl = new URL(`${META_API_BASE}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id",     appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri",  redirectUri);
  tokenUrl.searchParams.set("code",          code);

  const tokenRes = await fetch(tokenUrl.toString());
  if (!tokenRes.ok) {
    console.error("[Meta OAuth] Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${appUrl}/integrations?error=meta_token`);
  }
  const tokenJson: { access_token: string; token_type: string } = await tokenRes.json();
  const shortToken = tokenJson.access_token;

  // ── 4. Exchange for long-lived token (valid ~60 days) ────────────────────
  const longTokenUrl = new URL(`${META_API_BASE}/oauth/access_token`);
  longTokenUrl.searchParams.set("grant_type",        "fb_exchange_token");
  longTokenUrl.searchParams.set("client_id",         appId);
  longTokenUrl.searchParams.set("client_secret",     appSecret);
  longTokenUrl.searchParams.set("fb_exchange_token", shortToken);

  const longTokenRes = await fetch(longTokenUrl.toString());
  if (!longTokenRes.ok) {
    console.error("[Meta OAuth] Long-lived token exchange failed:", await longTokenRes.text());
    return NextResponse.redirect(`${appUrl}/integrations?error=meta_token`);
  }
  const longTokenJson: { access_token: string; expires_in?: number } = await longTokenRes.json();
  const accessToken = longTokenJson.access_token;
  const expiresIn   = longTokenJson.expires_in ?? 60 * 24 * 60 * 60; // default 60 days

  // ── 5. Fetch ad accounts for this user ────────────────────────────────────
  const acctUrl = new URL(`${META_API_BASE}/me/adaccounts`);
  acctUrl.searchParams.set("fields",       "id,name,account_status");
  acctUrl.searchParams.set("access_token", accessToken);
  acctUrl.searchParams.set("limit",        "10");

  const acctRes  = await fetch(acctUrl.toString());
  const acctJson = await acctRes.json();
  const adAccounts: Array<{ id: string; name: string; account_status: number }> =
    acctJson.data ?? [];

  // Use first active account (status 1 = ACTIVE)
  const activeAccount = adAccounts.find((a) => a.account_status === 1) ?? adAccounts[0];

  if (!activeAccount) {
    console.error("[Meta OAuth] No ad accounts found for this user");
    return NextResponse.redirect(`${appUrl}/integrations?error=meta_no_account`);
  }

  // ── 6. Store in encrypted cookie ─────────────────────────────────────────
  await setMetaToken({
    accessToken,
    accountId:   activeAccount.id,
    accountName: activeAccount.name,
    expiresAt:   Date.now() + expiresIn * 1000,
  });

  return NextResponse.redirect(`${appUrl}/integrations?connected=meta`);
}
