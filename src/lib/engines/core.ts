import { createClient as createSb, type SupabaseClient } from "@supabase/supabase-js";

export const TZ = "America/Phoenix";
export const PLATFORMS = ["instagram","facebook","tiktok","youtube","linkedin","x","google_business"] as const;

/** Privileged client for autonomous runs (heartbeat/cron). Server-only. */
export function adminClient(): SupabaseClient {
  const key = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set");
  return createSb(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false } });
}

export function parseJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned) as T;
}
