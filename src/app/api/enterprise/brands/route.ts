import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Enterprise admins add brands under their own organization.
 * POST { name }
 * RLS already permits enterprise admins to insert brands carrying their enterprise_id.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: membership } = await supabase
    .from("enterprise_members")
    .select("enterprise_id,is_admin")
    .eq("user_id", u.user.id)
    .eq("is_admin", true)
    .limit(1)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Enterprise admin access required" }, { status: 403 });

  const { name } = (await request.json()) as { name?: string };
  if (!name?.trim()) return NextResponse.json({ error: "Brand name is required" }, { status: 400 });

  const slug =
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
    "-" + Math.random().toString(36).slice(2, 6);

  const { data: brand, error } = await supabase
    .from("brands")
    .insert({ name: name.trim(), slug, status: "active", enterprise_id: membership.enterprise_id })
    .select("id,name")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The admin who created it is a member too, so it shows up everywhere immediately
  await supabase.from("brand_members").insert({ brand_id: brand.id, user_id: u.user.id });

  return NextResponse.json({ ok: true, brand });
}
