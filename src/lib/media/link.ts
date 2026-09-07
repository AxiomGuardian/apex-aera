import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived, signed links to media in Supabase storage, served from our
 * own domain (/api/media/<token>). Platforms that pull media from a URL
 * (TikTok) require the URL to be on a domain we own and have verified.
 */
function secret(): string {
  const s = process.env.MEDIA_LINK_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("No secret available to sign media links");
  return s;
}

export function signMediaLink(storagePath: string, ttlSeconds = 6 * 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ p: storagePath, e: exp })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return payload + "." + sig;
}

export function verifyMediaLink(token: string): { path: string } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expect = createHmac("sha256", secret()).update(payload).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expect);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const j = JSON.parse(Buffer.from(payload, "base64url").toString()) as { p?: string; e?: number };
    if (!j.p || !j.e || j.e < Math.floor(Date.now() / 1000)) return null;
    return { path: j.p };
  } catch { return null; }
}

export function publicMediaUrl(origin: string, storagePath: string, ttlSeconds?: number): string {
  return origin.replace(/\/$/, "") + "/api/media/" + signMediaLink(storagePath, ttlSeconds);
}
