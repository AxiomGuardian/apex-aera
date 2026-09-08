import { cookies } from "next/headers";
import { connectContext } from "@/lib/connect/finish";
import { tiktokCreds } from "@/lib/tiktok/creds";

/**
 * TikTok connect — step 2. Exchanges the code, reads the profile,
 * stores platform_connections (platform = tiktok, credentials.kind = "tiktok").
 * Access tokens last 24h and are refreshed from the refresh token (365 days).
 */
const TT = "https://open.tiktokapis.com/v2";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const denied = url.searchParams.get("error");

  const [nonce, brandId] = state.split(":");
  const ctx = await connectContext(origin, brandId || undefined, "tiktok");
  if ("redirect" in ctx && ctx.redirect) return ctx.redirect;
  const { admin, back, user } = ctx as Required<typeof ctx>;

  if (denied) return back("denied");
  if (!code || !nonce) return back("invalid");

  const jar = await cookies();
  const saved = jar.get("apex_tt_state")?.value;
  const verifier = jar.get("apex_tt_verifier")?.value;
  jar.set("apex_tt_state", "", { maxAge: 0, path: "/" });
  jar.set("apex_tt_verifier", "", { maxAge: 0, path: "/" });
  if (!saved || saved !== nonce || !verifier) return back("state_mismatch");

  const { key: clientKey, secret: clientSecret, sandbox } = tiktokCreds();
  if (!clientKey || !clientSecret) return back("not_configured");

  try {
    const form = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: origin + "/api/aera/connect/tiktok/callback",
      code_verifier: verifier,
    });
    const t = await fetch(TT + "/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    const tj = (await t.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; open_id?: string; scope?: string; error?: string; error_description?: string };
    if (!tj.access_token || !tj.open_id) throw new Error("token: " + (tj.error_description ?? tj.error ?? "exchange failed"));

    const p = await fetch(TT + "/user/info/?fields=open_id,display_name,username,avatar_url", { headers: { Authorization: "Bearer " + tj.access_token } });
    const pj = (await p.json()) as { data?: { user?: { display_name?: string; username?: string; avatar_url?: string } }; error?: { code?: string; message?: string } };
    if (pj.error && pj.error.code && pj.error.code !== "ok") throw new Error("profile: " + (pj.error.message ?? pj.error.code));
    const me = pj.data?.user ?? {};
    const account = me.username ? "@" + me.username : (me.display_name ?? tj.open_id);

    const now = Date.now();
    const { error } = await admin.from("platform_connections").upsert(
      {
        brand_id: brandId,
        platform: "tiktok",
        status: "connected",
        account_name: account,
        credentials: {
          kind: "tiktok",
          sandbox,
          open_id: tj.open_id,
          username: me.username ?? null,
          display_name: me.display_name ?? null,
          avatar_url: me.avatar_url ?? null,
          scope: tj.scope ?? null,
          access_token: tj.access_token,
          refresh_token: tj.refresh_token ?? null,
          expires_at: new Date(now + (tj.expires_in ?? 86400) * 1000).toISOString(),
          refresh_expires_at: new Date(now + (tj.refresh_expires_in ?? 365 * 86400) * 1000).toISOString(),
          connected_by: user.id,
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,platform" }
    );
    if (error) throw new Error("save: " + error.message);
    return back("connected", { account });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[TikTok Connect]", msg);
    return back("failed", { reason: msg.slice(0, 300) });
  }
}
