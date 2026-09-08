import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { tiktokCreds } from "@/lib/tiktok/creds";

/**
 * TikTok connect — step 1 (Login Kit, web flow with PKCE).
 * GET /api/aera/connect/tiktok?brandId=...
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const brandId = url.searchParams.get("brandId");

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.redirect(origin + "/login");
  if (!brandId) return NextResponse.redirect(origin + "/brand?tiktok=invalid");

  const clientKey = tiktokCreds().key;
  if (!clientKey) return NextResponse.redirect(origin + "/brand?tiktok=not_configured");

  const nonce = randomBytes(16).toString("hex");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const jar = await cookies();
  const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 600 };
  jar.set("apex_tt_state", nonce, cookieOpts);
  jar.set("apex_tt_verifier", verifier, cookieOpts);

  const oauth = new URL("https://www.tiktok.com/v2/auth/authorize/");
  oauth.searchParams.set("client_key", clientKey);
  oauth.searchParams.set("scope", "user.info.basic,video.upload,video.publish");
  oauth.searchParams.set("response_type", "code");
  oauth.searchParams.set("redirect_uri", origin + "/api/aera/connect/tiktok/callback");
  oauth.searchParams.set("state", nonce + ":" + brandId);
  oauth.searchParams.set("code_challenge", challenge);
  oauth.searchParams.set("code_challenge_method", "S256");
  return NextResponse.redirect(oauth.toString());
}
