import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";

/**
 * GET /api/aera/connect/instagram/check?brandId=...
 * Live health check of a brand's Instagram connection. Never returns the token.
 */
const IG = "https://graph.instagram.com/v21.0";

type MetaErr = { message?: string; code?: number; error_subcode?: number };

export async function GET(request: Request) {
  const brandId = new URL(request.url).searchParams.get("brandId");
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: brand } = await supabase.from("brands").select("id,name").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "No access to this brand" }, { status: 403 });

  const { data: conn } = await adminClient()
    .from("platform_connections").select("status,account_name,credentials,connected_at")
    .eq("brand_id", brandId).eq("platform", "instagram").maybeSingle();
  if (!conn) return NextResponse.json({ ok: false, step: "connection", detail: "No Instagram connection saved for this brand." });

  const creds = conn.credentials as { access_token?: string; ig_user_id?: string; expires_at?: string; kind?: string };
  const token = creds.access_token;
  const uid = creds.ig_user_id;
  if (!token || !uid) return NextResponse.json({ ok: false, step: "connection", detail: "Connection is missing its token. Reconnect." });

  const checks: Record<string, unknown> = {
    brand: brand.name, account: conn.account_name, status: conn.status, kind: creds.kind,
    connected_at: conn.connected_at, token_expires_at: creds.expires_at,
  };

  // 1. Profile
  const me = await fetch(`${IG}/me?fields=user_id,username,account_type,media_count,followers_count&access_token=${encodeURIComponent(token)}`);
  const mj = (await me.json()) as { username?: string; account_type?: string; media_count?: number; followers_count?: number; error?: MetaErr };
  if (mj.error) return NextResponse.json({ ok: false, step: "profile", detail: mj.error.message, code: mj.error.code, checks });
  checks.profile = { username: mj.username, account_type: mj.account_type, media_count: mj.media_count, followers: mj.followers_count };

  // 2. Publishing quota (needs instagram_business_content_publish)
  const q = await fetch(`${IG}/${uid}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token)}`);
  const qj = (await q.json()) as { data?: { quota_usage: number; config: { quota_total: number; quota_duration: number } }[]; error?: MetaErr };
  if (qj.error) {
    checks.publish = { ok: false, detail: qj.error.message, code: qj.error.code };
  } else {
    const d = qj.data?.[0];
    checks.publish = { ok: true, used_24h: d?.quota_usage ?? 0, limit_24h: d?.config?.quota_total ?? null };
  }

  // 3. Media read (needs instagram_business_basic)
  const m = await fetch(`${IG}/${uid}/media?fields=id,media_type,timestamp&limit=1&access_token=${encodeURIComponent(token)}`);
  const mm = (await m.json()) as { data?: unknown[]; error?: MetaErr };
  checks.media_read = mm.error ? { ok: false, detail: mm.error.message } : { ok: true, sample: mm.data?.length ?? 0 };

  const publishOk = (checks.publish as { ok: boolean }).ok;
  const professional = mj.account_type === "BUSINESS" || mj.account_type === "MEDIA_CREATOR";
  const verdict = !professional
    ? "Account is not a professional account. Publishing will fail."
    : !publishOk
    ? "Connected, but the publish permission was not granted. Reconnect and approve all permissions."
    : "Ready. AERA can publish to this account.";

  return NextResponse.json({ ok: professional && publishOk, verdict, checks });
}
