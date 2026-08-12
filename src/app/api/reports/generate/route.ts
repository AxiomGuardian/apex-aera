import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateReport } from "@/lib/engines/reporter";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { brandId } = (await request.json()) as { brandId?: string };
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });
  try {
    const report = await generateReport(supabase, brandId);
    return NextResponse.json({ report });
  } catch (err) {
    console.error("[Reporting Engine]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Report generation failed" }, { status: 500 });
  }
}
