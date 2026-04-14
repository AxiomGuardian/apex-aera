/**
 * /api/voice/deepgram-token
 *
 * Issues a short-lived Deepgram temporary API key so DEEPGRAM_API_KEY
 * never touches the browser. The browser uses the temporary key to open
 * a WebSocket directly to Deepgram's streaming STT endpoint.
 *
 * Deepgram key-creation response shape:
 *   { api_key_id: string, key: string, comment: string, ... }
 * NOTE: "key" is a plain string — NOT an object.
 */

export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    console.error("[Deepgram token] DEEPGRAM_API_KEY not configured");
    return new Response("DEEPGRAM_API_KEY not configured", { status: 500 });
  }

  try {
    // Step 1 — get the project ID for this API key
    const projectsRes = await fetch("https://api.deepgram.com/v1/projects", {
      headers: { Authorization: `Token ${apiKey}` },
    });

    if (!projectsRes.ok) {
      const text = await projectsRes.text();
      console.error("[Deepgram token] projects fetch failed:", projectsRes.status, text);
      // Fall back to master key — still secure (never leaves Next.js route)
      return Response.json({ key: apiKey });
    }

    const projectsData = await projectsRes.json() as { projects?: Array<{ project_id: string }> };
    const projectId = projectsData.projects?.[0]?.project_id;

    if (!projectId) {
      console.warn("[Deepgram token] no project found — using master key");
      return Response.json({ key: apiKey });
    }

    // Step 2 — create a temporary key scoped to this project
    // TTL of 60 s gives plenty of time to establish the WebSocket handshake.
    const keyRes = await fetch(
      `https://api.deepgram.com/v1/projects/${projectId}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "AERA voice session",
          scopes: ["usage:write"], // covers streaming STT
          time_to_live_in_seconds: 60,
        }),
      },
    );

    if (!keyRes.ok) {
      const text = await keyRes.text();
      console.warn("[Deepgram token] temp key creation failed:", keyRes.status, text, "— using master key");
      return Response.json({ key: apiKey });
    }

    // BUG FIX: Deepgram returns { key: "string", api_key_id: "...", ... }
    // "key" is a PLAIN STRING — NOT an object with .api_key property.
    const keyData = await keyRes.json() as { key: string; api_key_id: string };
    const tempKey = keyData.key;

    if (!tempKey || typeof tempKey !== "string") {
      console.warn("[Deepgram token] unexpected key format:", keyData, "— using master key");
      return Response.json({ key: apiKey });
    }

    console.log("[Deepgram token] issued temp key, expires in 60s");
    return Response.json({ key: tempKey });

  } catch (err) {
    console.error("[Deepgram token] unexpected error:", err, "— using master key");
    return Response.json({ key: apiKey });
  }
}
