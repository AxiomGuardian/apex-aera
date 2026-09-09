import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTool, DANGEROUS } from "@/lib/aera/tools";

/** POST { name, args, confirm? } -> { result, ui } . One tool, run under the caller's own permissions. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { name, args, confirm } = (await request.json()) as { name?: string; args?: Record<string, unknown>; confirm?: boolean };
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  if (DANGEROUS.has(name) && !(confirm || args?.confirm === true)) {
    return NextResponse.json({ result: { ok: false, needsConfirm: true, prompt: name === "publish_now" ? "Ask the person to confirm publishing right now, then call again with confirm true." : "Ask the person to confirm pulling the post, then call again with confirm true." }, ui: [] });
  }
  const ui: Record<string, unknown>[] = [];
  const result = await runTool(name, args ?? {}, supabase, u.user.id, ui);
  return NextResponse.json({ result, ui });
}
