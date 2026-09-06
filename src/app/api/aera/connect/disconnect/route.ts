import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";

/** POST { brandId, platform } — removes a platform connection from a brand. */
export async function POST(request: Request) {
  const { brandId, platform } = (await request.json()) as { brandId?: string; platform?: string };
  if (!brandId || !platform) return NextResponse.json({ error: "brandId and platform required" }, { status: 400 });

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: brand } = await supabase.from("brands").select("id").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "No access to this brand" }, { status: 403 });

  const { error } = await adminClient().from("platform_connections").delete().eq("brand_id", brandId).eq("platform", platform);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
