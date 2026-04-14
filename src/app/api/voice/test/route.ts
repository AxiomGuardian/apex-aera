/**
 * GET /api/voice/test
 *
 * Quick diagnostic endpoint — visit this URL in your browser while
 * the dev server is running to check if your API keys are valid.
 * Remove this file before deploying to production.
 */

export async function GET() {
  const elKey = process.env.ELEVENLABS_API_KEY;
  const dgKey = process.env.DEEPGRAM_API_KEY;

  const results: Record<string, unknown> = {
    elevenlabs: { configured: !!elKey, keyPrefix: elKey?.slice(0, 8) ?? "MISSING" },
    deepgram:   { configured: !!dgKey, keyPrefix: dgKey?.slice(0, 8) ?? "MISSING" },
  };

  // ── Test ElevenLabs ──────────────────────────────────────────
  if (elKey) {
    try {
      // Just fetch user info — doesn't consume any quota
      const res = await fetch("https://api.elevenlabs.io/v1/user", {
        headers: { "xi-api-key": elKey },
      });
      const body = await res.json();
      if (res.ok) {
        results.elevenlabs = {
          ...results.elevenlabs,
          status: "✅ VALID",
          plan: (body as { subscription?: { tier?: string } }).subscription?.tier ?? "unknown",
          charactersUsed: (body as { subscription?: { character_count?: number } }).subscription?.character_count ?? 0,
          charactersLimit: (body as { subscription?: { character_limit?: number } }).subscription?.character_limit ?? 0,
        };
      } else {
        results.elevenlabs = {
          ...results.elevenlabs,
          status: "❌ INVALID KEY",
          httpStatus: res.status,
          error: body,
        };
      }
    } catch (err) {
      results.elevenlabs = { ...results.elevenlabs, status: "❌ NETWORK ERROR", error: String(err) };
    }
  }

  // ── Test Deepgram ────────────────────────────────────────────
  if (dgKey) {
    try {
      const res = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${dgKey}` },
      });
      const body = await res.json();
      if (res.ok) {
        results.deepgram = {
          ...results.deepgram,
          status: "✅ VALID",
          projects: (body as { projects?: Array<{ name: string }> }).projects?.map((p) => p.name) ?? [],
        };
      } else {
        results.deepgram = {
          ...results.deepgram,
          status: "❌ INVALID KEY",
          httpStatus: res.status,
          error: body,
        };
      }
    } catch (err) {
      results.deepgram = { ...results.deepgram, status: "❌ NETWORK ERROR", error: String(err) };
    }
  }

  return Response.json(results, {
    headers: { "Content-Type": "application/json" },
  });
}
