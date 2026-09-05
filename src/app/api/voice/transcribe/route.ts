import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Speech engine fallback: record-then-transcribe. POST raw audio bytes -> { transcript }. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Speech engine not configured" }, { status: 503 });

  const contentType = request.headers.get("content-type") ?? "audio/webm";
  const audio = await request.arrayBuffer();
  if (!audio.byteLength) return NextResponse.json({ error: "No audio" }, { status: 400 });

  const dg = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true", {
    method: "POST",
    headers: { Authorization: "Token " + apiKey, "Content-Type": contentType },
    body: audio,
  });
  const data = (await dg.json().catch(() => ({}))) as { results?: { channels?: { alternatives?: { transcript?: string }[] }[] } };
  if (!dg.ok) return NextResponse.json({ error: "Transcription failed" }, { status: dg.status });
  return NextResponse.json({ transcript: data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "" });
}
