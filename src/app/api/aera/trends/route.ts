import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateTrendBrief } from "@/lib/engines/trends";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { brandId } = (await request.json()) as { brandId?: string };
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });
  try {
    const brief = await generateTrendBrief(supabase, brandId);
    return NextResponse.json({ brief });
  } catch (err) {
    console.error("[Trend Engine]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Trend research failed" }, { status: 500 });
  }
}
