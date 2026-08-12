import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCaptions } from "@/lib/engines/captioner";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { assetId } = (await request.json()) as { assetId?: string };
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  try {
    const captions = await generateCaptions(supabase, assetId);
    return NextResponse.json({ captions });
  } catch (err) {
    console.error("[Caption Engine]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Caption generation failed" }, { status: 500 });
  }
}
