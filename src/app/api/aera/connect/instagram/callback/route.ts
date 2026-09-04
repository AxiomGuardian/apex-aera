import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

/**
 * Instagram connect — step 2. Exchanges the code for a long-lived token,
 * reads the professional account id + username, and stores the connection
 * on the brand (platform = instagram, credentials.kind = "instagram_login").
 */

const IG_GRAPH = "https://graph.instagram.com";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const denied = url.searchParams.get("error");

  const [nonce, brandId] = state.split(":");
  const back = (q: string) =>
    NextResponse.redirect(origin + "/clients/" + (brandId ?? "") + "?instagram=" + q);

  if (denied) return back("denied");
  if (!code || !nonce || !brandId) return back("invalid");

  const jar = await cookies();
  const saved = jar.get("apex_ig_state")?.value;
  jar.set("apex_ig_state", "", { maxAge: 0, path: "/" });
  if (!saved || saved !== nonce) return back("state_mismatch");

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.redirect(origin + "/login");

  const appId = process.env.INSTAGRAM_APP_ID!;
  const appSecret = process.env.INSTAGRAM_APP_SECRET!;
  const redirectUri = origin + "/api/aera/connect/instagram/callback";

  try {
    // Code -> short-lived token (form POST)
    const form = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: code.replace(/#_$/, ""),
    });
    const t1 = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
    const j1 = (await t1.json()) as { access_token?: string; user_id?: string; error_message?: string };
    if (!j1.access_token) throw new Error(j1.error_message ?? "Token exchange failed");

    // Short-lived -> long-lived (~60 days, refreshable)
    const t2 = await fetch(
      IG_GRAPH + "/access_token?grant_type=ig_exchange_token&client_secret=" + appSecret +
      "&access_token=" + encodeURIComponent(j1.access_token)
    );
    const j2 = (await t2.json()) as { access_token?: string; expires_in?: number };
    const token = j2.access_token ?? j1.access_token;
    const expiresAt = new Date(Date.now() + (j2.expires_in ?? 60 * 24 * 3600) * 1000).toISOString();

    // Who is this?
    const me = await fetch(
      IG_GRAPH + "/v21.0/me?fields=id,user_id,username,account_type&access_token=" + encodeURIComponent(token)
    );
    const mj = (await me.json()) as { id?: string; user_id?: string; username?: string; account_type?: string };
    const igUserId = mj.user_id ?? mj.id;
    if (!igUserId) throw new Error("Could not read the Instagram account");

    await supabase.from("platform_connections").upsert(
      {
        brand_id: brandId,
        platform: "instagram",
        status: "connected",
        account_name: "@" + (mj.username ?? igUserId),
        credentials: {
          kind: "instagram_login",
          ig_user_id: igUserId,
          ig_username: mj.username ?? null,
          account_type: mj.account_type ?? null,
          access_token: token,
          expires_at: expiresAt,
          connected_by: u.user.id,
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,platform" }
    );

    return back("connected");
  } catch (e) {
    console.error("[Instagram Connect]", e);
    return back("failed");
  }
}
