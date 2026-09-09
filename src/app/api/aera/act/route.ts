import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runAera } from "@/lib/aera/run";

/**
 * AERA: talk, decide, act. Native tool calling on Grok.
 * POST { messages, confirm?: boolean } -> { say, steps, actions, ui, needsConfirm? }
 *
 * Reads and safe edits run immediately under the caller's own RLS. Irreversible
 * tools (publish_now, cancel_post) come back as needsConfirm until confirm: true.
 * The streaming twin lives at /api/aera/act/stream.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { messages, confirm } = (await request.json()) as { messages: { role: string; content: string }[]; confirm?: boolean };
  if (!Array.isArray(messages) || messages.length === 0) return NextResponse.json({ error: "messages required" }, { status: 400 });

  const surface = request.headers.get("x-apex-surface") === "ios" ? "ios" : "web";
  const r = await runAera({ supabase, userId: u.user.id, messages, confirm, surface });
  return NextResponse.json(r);
}
