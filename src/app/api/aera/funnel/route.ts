import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { draftFunnel } from "@/lib/engines/funnels";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { brandId, brief } = (await request.json()) as { brandId?: string; brief?: string };
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });
  try {
    const funnel = await draftFunnel(supabase, brandId, brief);
    return NextResponse.json({ funnel });
  } catch (err) {
    console.error("[Funnel Engine]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Funnel draft failed" }, { status: 500 });
  }
}
