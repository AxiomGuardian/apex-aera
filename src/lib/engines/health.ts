import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Connection health engine.
 * Pings each connected social account on a rolling basis so an expired or
 * revoked token is caught before a scheduled post silently fails.
 * Marks connections as "expired" (with the platform's message) or refreshes
 * their last_checked stamp when healthy.
 */

const GRAPH = "https://graph.facebook.com/v21.0";
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000; // 6 hours

type Creds = {
  kind?: "instagram_login" | "facebook_login";
  page_id?: string;
  page_token?: string;
  ig_user_id?: string;
  access_token?: string;
  expires_at?: string;
  last_checked?: string;
  last_error?: string | null;
};

const IG_GRAPH = "https://graph.instagram.com";

/** Instagram Login tokens last ~60 days and can be refreshed once older than 24h. */
async function refreshInstagramToken(creds: Creds): Promise<Creds> {
  if (!creds.access_token || !creds.expires_at) return creds;
  const msLeft = new Date(creds.expires_at).getTime() - Date.now();
  if (msLeft > 10 * 24 * 3600 * 1000) return creds; // plenty of runway
  try {
    const res = await fetch(
      IG_GRAPH + "/refresh_access_token?grant_type=ig_refresh_token&access_token=" + encodeURIComponent(creds.access_token)
    );
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (json.access_token) {
      return {
        ...creds,
        access_token: json.access_token,
        expires_at: new Date(Date.now() + (json.expires_in ?? 60 * 24 * 3600) * 1000).toISOString(),
      };
    }
  } catch { /* fall through, ping will surface a real failure */ }
  return creds;
}

async function pingMeta(platform: string, creds: Creds): Promise<{ ok: boolean; error?: string }> {
  const viaInstagram = creds.kind === "instagram_login";
  const token = viaInstagram ? creds.access_token : creds.page_token;
  const target = platform === "instagram" ? creds.ig_user_id : creds.page_id;
  if (!token || !target) return { ok: false, error: "Missing credentials" };
  try {
    const endpoint = viaInstagram
      ? IG_GRAPH + "/v21.0/me?fields=id&access_token=" + encodeURIComponent(token)
      : GRAPH + "/" + target + "?fields=id&access_token=" + encodeURIComponent(token);
    const res = await fetch(endpoint);
    const json = (await res.json()) as { id?: string; error?: { message?: string; code?: number } };
    if (json.id) return { ok: true };
    return { ok: false, error: json.error?.message ?? "Platform rejected the token" };
  } catch (e) {
    // Network hiccup: do not flip status, just report
    return { ok: true, error: e instanceof Error ? e.message : "network" };
  }
}

export async function checkConnections(sb: SupabaseClient) {
  const { data: conns } = await sb
    .from("platform_connections")
    .select("id,brand_id,platform,status,credentials,updated_at")
    .in("platform", ["facebook", "instagram"])
    .in("status", ["connected", "expired"]);

  let checked = 0, healthy = 0, expired = 0;
  const now = Date.now();

  for (const c of conns ?? []) {
    const creds = (c.credentials ?? {}) as Creds;
    const last = creds.last_checked ? new Date(creds.last_checked).getTime() : 0;
    if (now - last < CHECK_EVERY_MS) continue;

    checked++;
    const refreshed = creds.kind === "instagram_login" ? await refreshInstagramToken(creds) : creds;
    const result = await pingMeta(c.platform, refreshed);
    const nextCreds = { ...refreshed, last_checked: new Date().toISOString(), last_error: result.ok ? null : result.error ?? null };

    if (result.ok) {
      healthy++;
      await sb.from("platform_connections")
        .update({ status: "connected", credentials: nextCreds, updated_at: new Date().toISOString() })
        .eq("id", c.id);
    } else {
      expired++;
      await sb.from("platform_connections")
        .update({ status: "expired", credentials: nextCreds, updated_at: new Date().toISOString() })
        .eq("id", c.id);
    }
  }

  return { checked, healthy, expired };
}
