import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeAsset } from "@/lib/engines/analyzer";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { assetId } = (await request.json()) as { assetId?: string };
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  try {
    const analysis = await analyzeAsset(supabase, assetId);
    return NextResponse.json({ analysis });
  } catch (err) {
    console.error("[Analysis Engine]", err);
    return NextResponse.json({ error: "Analysis failed — try again." }, { status: 500 });
  }
}
