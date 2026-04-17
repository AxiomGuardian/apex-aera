// ─── Google Ads OAuth — Step 2: Callback ─────────────────────────────────────
// GET /api/integrations/connect/google/callback?code=...&state=...
// Exchanges code for access + refresh tokens, discovers the customer's Google
// Ads account ID, stores everything in an encrypted cookie.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setGoogleToken } from "@/lib/integrations/tokenStore";

const GOOGLE_ADS_API_VERSION = "v17";

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
    return NextResponse.redirect(`${appUrl}/integrations?error=google_denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=google_invalid`);
  }

  // ── 1. Verify CSRF state ──────────────────────────────────────────────────
  const jar        = await cookies();
  const savedState = jar.get("apex_oauth_state_google")?.value;
  jar.set("apex_oauth_state_google", "", { maxAge: 0, path: "/" });

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${appUrl}/integrations?error=google_csrf`);
  }

  const clientId     = process.env.GOOGLE_ADS_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET!;
  const devToken     = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;
  const redirectUri  = `${appUrl}/api/integrations/connect/google/callback`;

  // ── 2. Exchange code for tokens ───────────────────────────────────────────
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("[Google OAuth] Token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(`${appUrl}/integrations?error=google_token`);
  }

  const tokenJson: {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  } = await tokenRes.json();

  if (!tokenJson.refresh_token) {
    // This happens if the user already connected before and revoked.
    // Prompt=consent in the initiation route should prevent this, but just in case.
    console.error("[Google OAuth] No refresh token in response");
    return NextResponse.redirect(`${appUrl}/integrations?error=google_no_refresh`);
  }

  const { access_token: accessToken, refresh_token: refreshToken, expires_in } = tokenJson;

  // ── 3. Discover accessible Google Ads customer IDs ────────────────────────
  // Google Ads API: list accounts this token can manage
  const customersRes = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization:       `Bearer ${accessToken}`,
        "developer-token":   devToken,
      },
    }
  );

  let customerId = "";

  if (customersRes.ok) {
    const customersJson: { resourceNames?: string[] } = await customersRes.json();
    const resourceNames = customersJson.resourceNames ?? [];
    // resourceNames format: "customers/1234567890"
    if (resourceNames.length > 0) {
      // Use the first accessible account. For multi-account support, add a
      // selection step here later.
      customerId = resourceNames[0].split("/")[1] ?? "";
    }
  }

  if (!customerId) {
    console.warn("[Google OAuth] No Google Ads customer found — storing token without customer ID");
  }

  // ── 4. Store in encrypted cookie ─────────────────────────────────────────
  await setGoogleToken({
    accessToken,
    refreshToken,
    customerId,
    developerToken: devToken,
    expiresAt: Date.now() + expires_in * 1000,
  });

  return NextResponse.redirect(`${appUrl}/integrations?connected=google`);
}
