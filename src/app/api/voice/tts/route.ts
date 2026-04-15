/**
 * /api/voice/tts
 *
 * Secure ElevenLabs Text-to-Speech proxy.
 * Browser POSTs { text: string } → we call ElevenLabs server-side → MP3 streams back.
 * ELEVENLABS_API_KEY never touches the browser.
 *
 * AERA Voice: Katherine (NtS6nEHDYMQC9QczMQuq) — Calm Luxury · Narration · English
 *   Calm, sophisticated, professional female. Tuned for an AI brand advisor tone:
 *   high stability for consistent delivery, natural similarity_boost for warmth.
 *
 * Model priority (newest → oldest — fully unlocked key):
 *   eleven_flash_v2_5    → ElevenLabs' real-time conversational model. Lowest latency.
 *                          Best for voice assistants. Fully unlocked plans only.
 *   eleven_turbo_v2_5    → Best overall quality + speed balance.
 *   eleven_turbo_v2      → Previous turbo, solid fallback.
 *   eleven_monolingual_v1 → Original model — works on all plans including free tier.
 *
 * With a fully unlocked key the best model wins every time. Lower ones exist as a
 * safety net in case a model is temporarily unavailable.
 *
 * voice_settings: no "style" (Creator+ only), no "use_speaker_boost" (causes 422 on Starter).
 */

// ── AERA Voice configuration ──────────────────────────────────────
const AERA_VOICE_ID   = "NtS6nEHDYMQC9QczMQuq"; // Katherine — Calm, narration, English (AERA default)
const AERA_VOICE_NAME = "AERA";                   // Logical name used in logging

// Try models newest-first — first one that succeeds wins.
// eleven_flash_v2_5: purpose-built for real-time conversational AI (~75ms latency).
// eleven_turbo_v2_5: best quality + speed balance.
// eleven_turbo_v2:   previous turbo — solid fallback.
//
// NOTE: eleven_monolingual_v1 and eleven_multilingual_v1 are DEPRECATED and
// removed from ElevenLabs — do NOT add them back. They return 422 on all plans.
// Requires ElevenLabs Starter plan ($5/mo) or higher for model access.
const MODEL_PRIORITY = [
  "eleven_flash_v2_5",  // Real-time conversational — lowest latency, Starter+
  "eleven_turbo_v2_5",  // Best quality + speed balance, Starter+
  "eleven_turbo_v2",    // Previous turbo — solid fallback, Starter+
];

// speed: 1.0 = normal, 0.5 = slower, 2.0 = double speed.
// ElevenLabs handles pitch-preserving time-stretching server-side on flash/turbo models.
// Never use AudioBufferSourceNode.playbackRate — that shifts pitch ("Chipmunks" effect).
async function callElevenLabs(apiKey: string, voiceId: string, text: string, modelId: string, speed = 1.0) {
  return fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          // Tuned for premium character voices: high stability for consistent delivery,
          // high similarity for authentic character fidelity, style locked at 0 for clean output.
          stability:        0.85,  // consistent, authoritative delivery
          similarity_boost: 0.95,  // maximum character fidelity
          style:            0.0,   // locked — clean output, no stylistic drift
          // "use_speaker_boost" omitted — can cause 422 on free Starter tier
        },
        // Pitch-preserving speed control — ElevenLabs time-stretches server-side.
        // Range: 0.5–4.0. Supported on eleven_flash_v2_5 and eleven_turbo_v2_5.
        speed,
      }),
    },
  );
}

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let text: string;
  let speed: number;
  let voiceId: string;
  try {
    const body = await req.json() as { text?: string; speed?: number; voice_id?: string };
    text    = (body.text ?? "").trim();
    speed   = typeof body.speed === "number"
      ? Math.min(Math.max(body.speed, 0.5), 4.0)
      : 1.0;
    // Accept dynamic voice_id from request body — defaults to AERA (Katherine)
    voiceId = typeof body.voice_id === "string" && body.voice_id.trim()
      ? body.voice_id.trim()
      : AERA_VOICE_ID;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!text) {
    return new Response(
      JSON.stringify({ error: "text is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // ElevenLabs accepts up to ~5000 characters per request.
  // Hard-trimming shorter than that causes mid-sentence cutoff on long responses.
  // Soft-truncate only at the ElevenLabs limit — never earlier.
  const trimmed = text.length > 4900 ? text.slice(0, 4897) + "…" : text;

  // Try each model until one succeeds
  let lastStatus = 0;
  let lastError  = "";

  for (const modelId of MODEL_PRIORITY) {
    let ttsRes: Response;
    try {
      ttsRes = await callElevenLabs(apiKey, voiceId, trimmed, modelId, speed);
    } catch (err) {
      console.error(`[${AERA_VOICE_NAME} TTS] fetch failed (${modelId}):`, err);
      lastError = String(err);
      continue;
    }

    if (ttsRes.ok) {
      console.log(`[${AERA_VOICE_NAME} TTS] success with model ${modelId}`);
      // Stream MP3 bytes directly to the client
      return new Response(ttsRes.body, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "no-store",
          "X-ElevenLabs-Model": modelId,
        },
      });
    }

    lastStatus = ttsRes.status;
    lastError  = await ttsRes.text();
    console.error(`[${AERA_VOICE_NAME} TTS] error (${modelId}) ${lastStatus}:`, lastError);
    // 401 = bad key → no point trying other models
    if (lastStatus === 401) break;
  }

  // All models failed — return informative error
  return new Response(
    JSON.stringify({
      error:   "ElevenLabs TTS failed",
      status:  lastStatus,
      details: lastError,
    }),
    { status: 502, headers: { "Content-Type": "application/json" } },
  );
}
