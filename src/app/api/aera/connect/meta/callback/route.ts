import { cookies } from "next/headers";
import { connectContext } from "@/lib/connect/finish";

/**
 * Meta connect — step 2. Exchanges the code, finds the user's Facebook Page
 * and linked Instagram Business account, and stores per-brand credentials
 * in platform_connections (RLS enforces brand access).
 */

const GRAPH = "https://graph.facebook.com/v21.0";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") ?? "";
  const denied = url.searchParams.get("error");

  const [nonce, brandId] = state.split(":");
  const ctx = await connectContext(origin, brandId || undefined, "meta");
  if ("redirect" in ctx && ctx.redirect) return ctx.redirect;
  const { admin, back, user } = ctx as Required<typeof ctx>;

  if (denied) return back("denied");
  if (!code || !nonce) return back("invalid");

  const jar = await cookies();
  const saved = jar.get("apex_meta_state")?.value;
  jar.set("apex_meta_state", "", { maxAge: 0, path: "/" });
  if (!saved || saved !== nonce) return back("state_mismatch");

  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
  const redirectUri = origin + "/api/aera/connect/meta/callback";

  try {
    // Code -> short-lived token
    const t1 = await fetch(
      GRAPH + "/oauth/access_token?client_id=" + appId +
      "&client_secret=" + appSecret +
      "&redirect_uri=" + encodeURIComponent(redirectUri) +
      "&code=" + encodeURIComponent(code)
    );
    const j1 = (await t1.json()) as { access_token?: string; error?: { message?: string } };
    if (!j1.access_token) throw new Error(j1.error?.message ?? "Token exchange failed");

    // Short-lived -> long-lived (~60 days)
    const t2 = await fetch(
      GRAPH + "/oauth/access_token?grant_type=fb_exchange_token&client_id=" + appId +
      "&client_secret=" + appSecret +
      "&fb_exchange_token=" + encodeURIComponent(j1.access_token)
    );
    const j2 = (await t2.json()) as { access_token?: string };
    const userToken = j2.access_token ?? j1.access_token;

    // Pages this user manages (page tokens ride along)
    const pr = await fetch(
      GRAPH + "/me/accounts?fields=id,name,access_token&access_token=" + encodeURIComponent(userToken)
    );
    const pj = (await pr.json()) as { data?: { id: string; name: string; access_token: string }[] };
    const page = pj.data?.[0];
    if (!page) throw new Error("No Facebook Page found on this account. Create or get admin access to a Page first.");

    // Linked Instagram Business account, if any
    const ir = await fetch(
      GRAPH + "/" + page.id + "?fields=instagram_business_account{id,username}&access_token=" +
      encodeURIComponent(page.access_token)
    );
    const ij = (await ir.json()) as { instagram_business_account?: { id: string; username: string } };
    const ig = ij.instagram_business_account;

    const baseCreds = {
      page_id: page.id,
      page_token: page.access_token,
      page_name: page.name,
      ig_user_id: ig?.id ?? null,
      ig_username: ig?.username ?? null,
      connected_by: user.id,
    };

    // Upsert Facebook connection
    const { error: fbErr } = await admin.from("platform_connections").upsert(
      {
        brand_id: brandId,
        platform: "facebook",
        status: "connected",
        account_name: page.name,
        credentials: baseCreds,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "brand_id,platform" }
    );
    if (fbErr) throw new Error("save: " + fbErr.message);

    // Upsert Instagram connection when a business account is linked
    if (ig) {
      const { error: igErr } = await admin.from("platform_connections").upsert(
        {
          brand_id: brandId,
          platform: "instagram",
          status: "connected",
          account_name: "@" + ig.username,
          credentials: baseCreds,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "brand_id,platform" }
      );
      if (igErr) throw new Error("save: " + igErr.message);
    }

    return back(ig ? "connected" : "connected_fb_only", { account: page.name + (ig ? " + @" + ig.username : "") });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[Meta Connect]", msg);
    return back("failed", { reason: msg.slice(0, 160) });
  }
}
