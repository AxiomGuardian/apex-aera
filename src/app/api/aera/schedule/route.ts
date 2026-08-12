import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scheduleAsset } from "@/lib/engines/scheduler";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { assetId } = (await request.json()) as { assetId?: string };
  if (!assetId) return NextResponse.json({ error: "assetId required" }, { status: 400 });
  try {
    const posts = await scheduleAsset(supabase, assetId);
    return NextResponse.json({ posts });
  } catch (err) {
    console.error("[Scheduling Engine]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Scheduling failed" }, { status: 500 });
  }
}
