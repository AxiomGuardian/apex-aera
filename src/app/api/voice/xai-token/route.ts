import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TOOLS } from "@/lib/aera/tools";
import { logServer } from "@/lib/log/server";

/**
 * Realtime voice (xAI): short-lived client secret plus the session config the
 * device should send. The real XAI_API_KEY never leaves the server.
 * GET -> { token, expires_in, model, session }
 */
export async function GET() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const key = process.env.XAI_API_KEY;
  if (!key) {
    void logServer(u.user.id, { event: "voice.token", area: "voice", ok: false, label: "Realtime voice is not configured on the server", detail: { engine: "xai" } });
    return NextResponse.json({ error: "Realtime voice not configured" }, { status: 503 });
  }

  const r = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify({ expires_after: { seconds: 600 } }),
  });
  const j = (await r.json().catch(() => ({}))) as { value?: string; client_secret?: { value?: string }; expires_at?: number; error?: string };
  const token = j.value ?? j.client_secret?.value;
  if (!r.ok || !token) {
    void logServer(u.user.id, { event: "voice.token", area: "voice", ok: false, label: "xAI refused a realtime token", detail: { engine: "xai", status: r.status, error: String(j.error ?? "").slice(0, 300) } });
    return NextResponse.json({ error: "Could not mint a realtime token: " + (j.error ?? r.status) }, { status: 502 });
  }

  // Live context so she knows the brands before the first word.
  const [{ data: prof }, { data: brands }, { data: mems }] = await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id", u.user.id).maybeSingle(),
    supabase.from("brands").select("id,name,tone_of_voice,target_audience,website_url,autopilot,billing_status").neq("status", "archived").limit(8),
    supabase.from("aera_memories").select("note").order("created_at", { ascending: false }).limit(20),
  ]);
  const first = (prof?.full_name ?? "there").split(" ")[0];
  const brandList = (brands ?? []).map((b) => `- ${b.name} (id ${b.id}) tone: ${b.tone_of_voice ?? "unset"}; audience: ${b.target_audience ?? "unset"}; site: ${b.website_url ?? "none"}; autopilot ${b.autopilot === false ? "off" : "on"}`).join("\n");
  const memory = (mems ?? []).map((m) => `- ${m.note}`).join("\n");

  const instructions = `You are AERA, the marketing intelligence at the heart of APEX AERA, talking with ${first}, who runs the brand. Your name is AERA, spelled A E R A; never Sarah.
Speak naturally in one to three short sentences. Lead with the answer. No lists.
Use the tools whenever a request needs data or a change; call read tools first when you need ids. After a change, say exactly what changed. When you navigate or highlight, mention it briefly.
Infer the brand's industry from its voice, audience and website and shape suggestions for it. Never invent posts, numbers or ids.
Before publish_now or cancel_post, ask for a yes and wait for it.
Use remember when you learn a preference, goal, deadline or fact that will matter later.

BRANDS YOU CAN ACT ON:
${brandList || "(none)"}

WHAT YOU REMEMBER:
${memory || "(nothing yet)"}

Now: ${new Date().toISOString()} (Phoenix is UTC-7).`;

  void logServer(u.user.id, { event: "voice.token", area: "voice", ok: true, label: "Minted a realtime voice token", detail: { engine: "xai", model: process.env.XAI_VOICE_MODEL ?? "grok-voice-latest", brands: (brands ?? []).length } });

  return NextResponse.json({
    token,
    expires_in: 600,
    model: process.env.XAI_VOICE_MODEL ?? "grok-voice-latest",
    session: {
      voice: process.env.AERA_XAI_VOICE ?? "ara",
      instructions,
      // Echo cancellation runs on the device, so she does not need a high bar to
      // avoid hearing herself. A lower threshold means normal speaking volume is
      // enough, and a shorter silence means she answers sooner.
      turn_detection: { type: "server_vad", threshold: 0.5, silence_duration_ms: 520, prefix_padding_ms: 300, create_response: true, interrupt_response: true },
      audio: {
        input: { format: { type: "audio/pcm", rate: 16000 }, transport: "json", transcription: { keyterms: ["AERA", "APEX", "autopilot"] } },
        output: { format: { type: "audio/pcm", rate: 24000 }, transport: "json" },
      },
      tools: TOOLS.map((t) => ({ type: "function", name: t.name, description: t.description, parameters: t.parameters })),
      replace: { "AERA": "Aira" },
    },
  });
}
