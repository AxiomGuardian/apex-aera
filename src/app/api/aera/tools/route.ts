import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runTool, DANGEROUS } from "@/lib/aera/tools";
import { stepLabel } from "@/lib/aera/steps";
import { logServer } from "@/lib/log/server";

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
  const t0 = Date.now();
  let result: unknown;
  try {
    result = await runTool(name, args ?? {}, supabase, u.user.id, ui);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    void logServer(u.user.id, { event: "aera.tool", area: "voice", surface: "ios", ok: false, ms: Date.now() - t0, label: stepLabel(name, args ?? {}), detail: { tool: name, args, error: message.slice(0, 500) } });
    return NextResponse.json({ result: { ok: false, error: message }, ui: [] });
  }
  const failed = !!(result && typeof result === "object" && (result as { ok?: boolean }).ok === false);
  void logServer(u.user.id, {
    event: "aera.tool", area: "voice", surface: "ios", ok: !failed, ms: Date.now() - t0,
    label: stepLabel(name, args ?? {}),
    detail: { tool: name, args, result: JSON.stringify(result ?? null).slice(0, 800), via: "realtime" },
  });
  return NextResponse.json({ result, ui });
}
