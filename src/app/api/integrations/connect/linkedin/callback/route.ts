// ─── LinkedIn Ads OAuth — Step 2: Callback ───────────────────────────────────
// GET /api/integrations/connect/linkedin/callback?code=...&state=...
// Exchanges code for access token, fetches the user's sponsor account,
// stores in an encrypted cookie, redirects to /integrations.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setLinkedInToken } from "@/lib/integrations/tokenStore";

const LI_API_BASE    = "https://api.linkedin.com/rest";
const LI_API_VERSION = "202401";

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
  const appUrl    = getAppUrl();

  if (errorCode) {
    return NextResponse.redirect(`${appUrl}/integrations?error=linkedin_denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=linkedin_invalid`);
  }

  // ── 1. Verify CSRF state ──────────────────────────────────────────────────
  const jar        = await cookies();
  const savedState = jar.get("apex_oauth_state_linkedin")?.value;
  jar.set("apex_oauth_state_linkedin", "", { maxAge: 0, path: "/" });

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=linkedin_csrf`);
  }

  const clientId     = process.env.LINKEDIN_CLIENT_ID!;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET!;
  const redirectUri  = `${appUrl}/api/integrations/connect/linkedin/callback`;

  // ── 2. Exchange code for access token ─────────────────────────────────────
  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type:    "authorization_code",
      code,
      redirect_uri:  redirectUri,
      client_id:     clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    console.error("[LinkedIn OAuth] Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${appUrl}/integrations?error=linkedin_token`);
  }

  const tokenJson: {
    access_token: string;
    expires_in: number;
  } = await tokenRes.json();

  const { access_token: accessToken, expires_in } = tokenJson;

  // ── 3. Fetch accessible sponsor accounts ─────────────────────────────────
  const accountsUrl = new URL(`${LI_API_BASE}/adAccounts`);
  accountsUrl.searchParams.set("q",      "search");
  accountsUrl.searchParams.set("fields", "id,name,status");
  accountsUrl.searchParams.set("count",  "10");

  const accountsRes = await fetch(accountsUrl.toString(), {
    headers: {
      Authorization:               `Bearer ${accessToken}`,
      "LinkedIn-Version":          LI_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  let accountId   = "";
  let accountName = "";

  if (accountsRes.ok) {
    const accountsJson: {
      elements?: Array<{ id: number; name: string; status: string }>
    } = await accountsRes.json();
    const accounts = accountsJson.elements ?? [];
    // Use first active account
    const active = accounts.find((a) => a.status === "ENABLED") ?? accounts[0];
    if (active) {
      accountId   = String(active.id);
      accountName = active.name;
    }
  }

  if (!accountId) {
    console.warn("[LinkedIn OAuth] No ad account found — storing token without account ID");
  }

  // ── 4. Store in encrypted cookie ─────────────────────────────────────────
  await setLinkedInToken({
    accessToken,
    accountId,
    accountName,
    expiresAt: Date.now() + expires_in * 1000,
  });

  return NextResponse.redirect(`${appUrl}/integrations?connected=linkedin`);
}
