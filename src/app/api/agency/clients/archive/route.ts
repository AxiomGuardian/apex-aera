import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";
import { archiveBrand } from "@/lib/brands/lifecycle";

/** Archive a client. POST { brandId, reason? }. Agency admins only. Restorable for 30 days. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
  if (me?.role !== "agency_admin") return NextResponse.json({ error: "Agency access required" }, { status: 403 });

  const { brandId, reason } = (await request.json()) as { brandId?: string; reason?: string };
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });
  try {
    await archiveBrand(adminClient(), brandId, reason ?? "archived by " + (u.user.email ?? "agency"));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Archive failed" }, { status: 500 });
  }
}
