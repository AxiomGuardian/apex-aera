import { NextResponse } from "next/server";

/** Public, secret-free: is the speech engine configured and can it mint a credential? */
export async function GET() {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) return NextResponse.json({ configured: false, grant: "no key on server" });
  let grant = "unknown";
  let tempKey = "unknown";
  try {
    const g = await fetch("https://api.deepgram.com/v1/auth/grant", { method: "POST", headers: { Authorization: "Token " + apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ ttl_seconds: 30 }) });
    grant = g.ok ? "ok" : "HTTP " + g.status + " " + (await g.text()).slice(0, 120);
  } catch (e) { grant = "error " + (e instanceof Error ? e.message : String(e)); }
  try {
    const pr = await fetch("https://api.deepgram.com/v1/projects", { headers: { Authorization: "Token " + apiKey } });
    tempKey = pr.ok ? "projects ok" : "HTTP " + pr.status;
  } catch (e) { tempKey = "error " + (e instanceof Error ? e.message : String(e)); }
  return NextResponse.json({ configured: true, keyLength: apiKey.length, grant, tempKey, voice: process.env.AERA_VOICE ?? "aura-2-thalia-en" });
}
