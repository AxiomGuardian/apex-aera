import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { writeLog, type LogEvent } from "@/lib/log/server";

/**
 * Activity log ingest. POST { events: [...] } from the portal or the phone.
 * The row is always attributed to the signed-in person, never to whatever the
 * client claims. Answers 202 either way so a log write can never stall the UI.
 */
export const maxDuration = 15;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: u } = await supabase.auth.getUser();

    const body = (await request.json()) as { events?: LogEvent[]; surface?: "web" | "ios" };
    let events = Array.isArray(body.events) ? body.events : [];
    if (!events.length) return NextResponse.json({ ok: true, written: 0 });

    // Signed out, the only thing worth keeping is why someone could not get in.
    if (!u.user) {
      events = events.filter((e) => typeof e.event === "string" && e.event.startsWith("auth."));
      if (!events.length) return NextResponse.json({ ok: false }, { status: 202 });
      await writeLog(null, events, body.surface ?? "web");
      return NextResponse.json({ ok: true, written: events.length });
    }

    await writeLog(u.user.id, events, body.surface ?? "web");
    return NextResponse.json({ ok: true, written: Math.min(events.length, 100) });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
