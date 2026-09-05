import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readBrandVoice } from "@/lib/engines/voice";

/**
 * POST { brandId, action: "read" | "confirm" }
 *  read    -> AERA interprets the raw voice inputs and returns the profile
 *  confirm -> client says "that's right"; stamps voice_confirmed_at
 * RLS on brands decides who may touch which brand.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { brandId, action } = (await request.json()) as { brandId?: string; action?: "read" | "confirm" };
  if (!brandId || !action) return NextResponse.json({ error: "brandId and action required" }, { status: 400 });

  try {
    if (action === "read") {
      const profile = await readBrandVoice(supabase, brandId);
      return NextResponse.json({ ok: true, profile });
    }
    const { error } = await supabase.from("brands").update({ voice_confirmed_at: new Date().toISOString() }).eq("id", brandId);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[Voice Reader]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Voice read failed" }, { status: 500 });
  }
}
