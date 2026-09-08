import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * AERA voice: text -> speech through Deepgram Aura. Returns audio/mpeg.
 * POST { text, voice? }  voice defaults to a calm, confident female voice.
 */
export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Voice engine not configured" }, { status: 503 });

  const { text, voice } = (await request.json()) as { text?: string; voice?: string };
  const clean = (text ?? "").replace(/\s+/g, " ").trim().slice(0, 1800);
  if (!clean) return NextResponse.json({ error: "Nothing to say" }, { status: 400 });

  const model = voice ?? process.env.AERA_VOICE ?? "aura-2-thalia-en";
  const dg = await fetch("https://api.deepgram.com/v1/speak?model=" + encodeURIComponent(model) + "&encoding=mp3", {
    method: "POST",
    headers: { Authorization: "Token " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text: clean }),
  });
  if (!dg.ok) {
    const msg = await dg.text().catch(() => "");
    return NextResponse.json({ error: "Voice failed: " + msg.slice(0, 200) }, { status: 502 });
  }
  const audio = await dg.arrayBuffer();
  return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
