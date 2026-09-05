import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Speech engine: short-lived Deepgram credential for the browser.
 * The real DEEPGRAM_API_KEY never leaves the server.
 *   Strategy 1: 120s temporary project key (needs an admin-scoped key)
 *   Strategy 2: 60s grant token (works with any key)
 * Requires an APEX session so strangers cannot mint against the account.
 * Returns { mode: "token" | "bearer", access_token } and, for the older chat hook, { key }.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Speech engine not configured" }, { status: 503 });

  // Strategy 1: temporary project key
  try {
    const pr = await fetch("https://api.deepgram.com/v1/projects", { headers: { Authorization: "Token " + apiKey } });
    const pj = (await pr.json().catch(() => ({}))) as { projects?: { project_id: string }[] };
    const projectId = pj.projects?.[0]?.project_id;
    if (projectId) {
      const kr = await fetch("https://api.deepgram.com/v1/projects/" + projectId + "/keys", {
        method: "POST",
        headers: { Authorization: "Token " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ comment: "apex-dictation", scopes: ["usage:write"], time_to_live_in_seconds: 120 }),
      });
      const kd = (await kr.json().catch(() => ({}))) as { key?: string };
      if (kr.ok && typeof kd.key === "string") {
        return NextResponse.json({ mode: "token", access_token: kd.key, key: kd.key });
      }
    }
  } catch { /* fall through */ }

  // Strategy 2: grant token
  try {
    const g = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: { Authorization: "Token " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });
    const gd = (await g.json().catch(() => ({}))) as { access_token?: string; expires_in?: number };
    if (g.ok && gd.access_token) {
      return NextResponse.json({ mode: "bearer", access_token: gd.access_token, key: gd.access_token, expires_in: gd.expires_in });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ error: "Could not mint a speech credential" }, { status: 500 });
}
