import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";

/** A sign-in counts as activity for every brand this person belongs to. */
export async function POST() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const admin = adminClient();
  const { data: rows } = await admin.from("brand_members").select("brand_id").eq("user_id", u.user.id);
  const ids = (rows ?? []).map((r) => r.brand_id);
  if (ids.length) await admin.from("brands").update({ last_activity_at: new Date().toISOString() }).in("id", ids);
  return NextResponse.json({ ok: true, touched: ids.length });
}
