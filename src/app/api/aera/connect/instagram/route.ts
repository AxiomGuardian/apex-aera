import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Instagram connect — step 1 (Instagram API with Instagram Login).
 * No Facebook account or Page required. The brand owner signs in with
 * their Instagram Business/Creator account directly.
 * GET /api/aera/connect/instagram?brandId=...
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const brandId = url.searchParams.get("brandId");

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.redirect(origin + "/login");
  if (!brandId) return NextResponse.redirect(origin + "/clients?error=missing_brand");

  const appId = process.env.INSTAGRAM_APP_ID;
  if (!appId) {
    return NextResponse.redirect(origin + "/clients/" + brandId + "?instagram=not_configured");
  }

  const nonce = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("apex_ig_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const redirectUri = origin + "/api/aera/connect/instagram/callback";
  const scopes = [
    "instagram_business_basic",
    "instagram_business_content_publish",
    "instagram_business_manage_insights",
  ].join(",");

  const oauth = new URL("https://www.instagram.com/oauth/authorize");
  oauth.searchParams.set("client_id", appId);
  oauth.searchParams.set("redirect_uri", redirectUri);
  oauth.searchParams.set("scope", scopes);
  oauth.searchParams.set("response_type", "code");
  oauth.searchParams.set("state", nonce + ":" + brandId);

  return NextResponse.redirect(oauth.toString());
}
