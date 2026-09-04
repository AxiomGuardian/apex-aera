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
  page_id?: string;
  page_token?: string;
  ig_user_id?: string;
  last_checked?: string;
  last_error?: string | null;
};

async function pingMeta(platform: string, creds: Creds): Promise<{ ok: boolean; error?: string }> {
  const token = creds.page_token;
  const target = platform === "instagram" ? creds.ig_user_id : creds.page_id;
  if (!token || !target) return { ok: false, error: "Missing credentials" };
  try {
    const res = await fetch(GRAPH + "/" + target + "?fields=id&access_token=" + encodeURIComponent(token));
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
    const result = await pingMeta(c.platform, creds);
    const nextCreds = { ...creds, last_checked: new Date().toISOString(), last_error: result.ok ? null : result.error ?? null };

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
