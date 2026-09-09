import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads the activity log. RLS decides what comes back: you see your own rows,
 * agency and enterprise admins see everyone's.
 *
 * GET /api/logs?limit=200&surface=ios&area=voice&event=voice.turn&user=<uid>
 *              &brand=<id>&since=2026-09-09T00:00:00Z&only=errors&q=deepgram
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const p = new URL(request.url).searchParams;
  const limit = Math.min(Number(p.get("limit") ?? 200) || 200, 1000);

  let q = supabase
    .from("activity_log")
    .select("id,created_at,user_id,brand_id,surface,area,event,label,ok,ms,detail,session_id,app_version")
    .order("created_at", { ascending: false })
    .limit(limit);

  const surface = p.get("surface"); if (surface) q = q.eq("surface", surface);
  const area = p.get("area");       if (area) q = q.eq("area", area);
  const event = p.get("event");     if (event) q = q.eq("event", event);
  const user = p.get("user");       if (user) q = q.eq("user_id", user);
  const brand = p.get("brand");     if (brand) q = q.eq("brand_id", brand);
  const since = p.get("since");     if (since) q = q.gte("created_at", since);
  if (p.get("only") === "errors") q = q.eq("ok", false);
  const text = p.get("q");          if (text) q = q.or(`label.ilike.%${text}%,event.ilike.%${text}%`);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Names, so the log reads like people instead of uuids.
  const ids = Array.from(new Set((data ?? []).map((r) => r.user_id).filter(Boolean))) as string[];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
    for (const pr of profs ?? []) names[pr.id as string] = (pr.full_name as string) || (pr.email as string) || "";
  }

  return NextResponse.json({ count: data?.length ?? 0, names, rows: data ?? [] });
}
