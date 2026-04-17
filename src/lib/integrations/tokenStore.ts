// ─── AERA Integration Token Store ────────────────────────────────────────────
// Stores per-user OAuth tokens in encrypted HttpOnly cookies.
// Each platform gets its own cookie: apex_tkn_meta, apex_tkn_google, etc.
//
// Security model:
//   • Encryption: AES-256-GCM keyed from NEXTAUTH_SECRET
//   • HttpOnly: JS cannot read these cookies
//   • Secure: HTTPS only
//   • SameSite: lax (allows OAuth redirect callbacks)
//
// Note: Cookie-based storage is per-browser. For multi-device support,
// upgrade to Vercel KV or a database keyed by session user ID.
//
// This module is SERVER-ONLY. Never import from client components.

import { cookies } from "next/headers";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MetaTokenData = {
  accessToken: string;
  accountId: string;
  accountName: string;
  expiresAt: number; // Unix ms — long-lived tokens last ~60 days
};

export type GoogleTokenData = {
  accessToken: string;
  refreshToken: string;
  customerId: string;       // 10-digit, no dashes
  developerToken: string;   // APEX's developer token (from env)
  expiresAt: number;        // access tokens expire in ~1h; refresh token is durable
};

export type LinkedInTokenData = {
  accessToken: string;
  accountId: string;
  accountName: string;
  expiresAt: number; // LinkedIn tokens expire in 60 days
};

export type PlatformTokenMap = {
  meta?: MetaTokenData;
  google?: GoogleTokenData;
  linkedin?: LinkedInTokenData;
};

const COOKIE_NAMES = {
  meta:     "apex_tkn_meta",
  google:   "apex_tkn_google",
  linkedin: "apex_tkn_linkedin",
} as const;

// 60-day cookie lifetime (most token lifetimes)
const MAX_AGE_SECONDS = 60 * 24 * 60 * 60;

// ─── Encryption ───────────────────────────────────────────────────────────────

function getEncKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set — cannot encrypt tokens");
  return createHash("sha256").update(secret).digest();
}

function encrypt(plaintext: string): string {
  const key = getEncKey();
  const iv  = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag   = cipher.getAuthTag();
  // Format: iv(hex).ciphertext(hex).authtag(hex)
  return `${iv.toString("hex")}.${encrypted.toString("hex")}.${authTag.toString("hex")}`;
}

function decrypt(ciphertext: string): string {
  const key = getEncKey();
  const parts = ciphertext.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [ivHex, encHex, tagHex] = parts;
  const iv         = Buffer.from(ivHex, "hex");
  const encrypted  = Buffer.from(encHex, "hex");
  const authTag    = Buffer.from(tagHex, "hex");
  const decipher   = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getMetaToken(): Promise<MetaTokenData | null> {
  try {
    const jar  = await cookies();
    const raw  = jar.get(COOKIE_NAMES.meta)?.value;
    if (!raw) return null;
    return JSON.parse(decrypt(raw)) as MetaTokenData;
  } catch { return null; }
}

export async function getGoogleToken(): Promise<GoogleTokenData | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE_NAMES.google)?.value;
    if (!raw) return null;
    return JSON.parse(decrypt(raw)) as GoogleTokenData;
  } catch { return null; }
}

export async function getLinkedInToken(): Promise<LinkedInTokenData | null> {
  try {
    const jar = await cookies();
    const raw = jar.get(COOKIE_NAMES.linkedin)?.value;
    if (!raw) return null;
    return JSON.parse(decrypt(raw)) as LinkedInTokenData;
  } catch { return null; }
}

// ─── Write ────────────────────────────────────────────────────────────────────

function cookieOptions() {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path:     "/",
    maxAge:   MAX_AGE_SECONDS,
  };
}

export async function setMetaToken(data: MetaTokenData): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAMES.meta, encrypt(JSON.stringify(data)), cookieOptions());
}

export async function setGoogleToken(data: GoogleTokenData): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAMES.google, encrypt(JSON.stringify(data)), cookieOptions());
}

export async function setLinkedInToken(data: LinkedInTokenData): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAMES.linkedin, encrypt(JSON.stringify(data)), cookieOptions());
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function clearToken(platform: keyof typeof COOKIE_NAMES): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAMES[platform], "", { ...cookieOptions(), maxAge: 0 });
}

// ─── Batch read (for sync route) ─────────────────────────────────────────────

export async function getAllTokens(): Promise<PlatformTokenMap> {
  const [meta, google, linkedin] = await Promise.all([
    getMetaToken(),
    getGoogleToken(),
    getLinkedInToken(),
  ]);
  return {
    ...(meta     ? { meta }     : {}),
    ...(google   ? { google }   : {}),
    ...(linkedin ? { linkedin } : {}),
  };
}

// ─── Status check (fast — no API calls, just cookie presence) ────────────────

export async function getConnectionStatuses(): Promise<
  Record<"meta" | "google" | "linkedin", boolean>
> {
  const jar = await cookies();
  return {
    meta:     !!jar.get(COOKIE_NAMES.meta)?.value,
    google:   !!jar.get(COOKIE_NAMES.google)?.value,
    linkedin: !!jar.get(COOKIE_NAMES.linkedin)?.value,
  };
}
