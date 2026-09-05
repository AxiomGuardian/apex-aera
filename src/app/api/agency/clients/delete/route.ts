import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";
import { purgeBrand } from "@/lib/brands/lifecycle";

/**
 * Permanently purge a client. Works on active or archived brands.
 * POST { brandId }. Agency admins only.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
  if (me?.role !== "agency_admin") return NextResponse.json({ error: "Agency access required" }, { status: 403 });

  const { brandId } = (await request.json()) as { brandId?: string };
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });

  const admin = adminClient();
  const { data: brand } = await admin.from("brands").select("id,name,status").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    const result = await purgeBrand(admin, brandId);
    return NextResponse.json({ ok: true, name: brand.name, ...result });
  } catch (e) {
    console.error("[Purge client]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Purge failed" }, { status: 500 });
  }
}
