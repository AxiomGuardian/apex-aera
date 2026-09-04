import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

/**
 * Meta connect — step 1. Brand-scoped OAuth for publishing.
 * GET /api/aera/connect/meta?brandId=...
 * Scopes cover Facebook Page posting + Instagram content publishing.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const brandId = url.searchParams.get("brandId");

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.redirect(origin + "/login");
  if (!brandId) return NextResponse.redirect(origin + "/clients?error=missing_brand");

  const appId = process.env.META_APP_ID;
  if (!appId) {
    return NextResponse.redirect(origin + "/clients/" + brandId + "?meta=not_configured");
  }

  const nonce = randomBytes(16).toString("hex");
  const jar = await cookies();
  jar.set("apex_meta_state", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const redirectUri = origin + "/api/aera/connect/meta/callback";
  const scopes = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_manage_posts",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ].join(",");

  const oauth = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  oauth.searchParams.set("client_id", appId);
  oauth.searchParams.set("redirect_uri", redirectUri);
  oauth.searchParams.set("scope", scopes);
  oauth.searchParams.set("state", nonce + ":" + brandId);
  oauth.searchParams.set("response_type", "code");

  return NextResponse.redirect(oauth.toString());
}
