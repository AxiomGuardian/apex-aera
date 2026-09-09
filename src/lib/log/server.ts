import { adminClient } from "@/lib/engines/core";

/**
 * The activity log, server side.
 *
 * Every meaningful thing a person or AERA does lands in public.activity_log so
 * we can open one place and see what happened: who, where, what, how long, and
 * whether it worked. Writes are best effort. Logging must never break a request.
 */

export type LogEvent = {
  event: string;                 // voice.open, dictation.final, content.upload, aera.tool ...
  area?: string;                 // voice | chat | content | queue | brand | auth | nav | connect | system
  label?: string;                // one short human sentence
  ok?: boolean;
  ms?: number;
  detail?: Record<string, unknown>;
  brandId?: string | null;
  surface?: "web" | "ios" | "server";
  sessionId?: string | null;
  appVersion?: string | null;
  at?: string;                   // client timestamp, ISO
};

const MAX_DETAIL = 4000;

function trim(detail: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!detail) return {};
  try {
    const s = JSON.stringify(detail);
    if (s.length <= MAX_DETAIL) return detail;
    return { truncated: true, preview: s.slice(0, MAX_DETAIL) };
  } catch {
    return { unserializable: true };
  }
}

/** Writes a batch. Never throws. */
export async function writeLog(userId: string | null, events: LogEvent[], fallbackSurface: "web" | "ios" | "server" = "server") {
  if (!events.length) return;
  const rows = events.slice(0, 100).map((e) => ({
    user_id: userId,
    brand_id: e.brandId ?? null,
    surface: e.surface ?? fallbackSurface,
    area: e.area ?? null,
    event: String(e.event ?? "unknown").slice(0, 80),
    label: e.label ? String(e.label).slice(0, 300) : null,
    ok: e.ok !== false,
    ms: typeof e.ms === "number" && isFinite(e.ms) ? Math.round(e.ms) : null,
    detail: trim(e.detail),
    session_id: e.sessionId ?? null,
    app_version: e.appVersion ?? null,
    created_at: e.at ?? new Date().toISOString(),
  }));
  try {
    await adminClient().from("activity_log").insert(rows);
  } catch {
    // A log write is never worth failing a request over.
  }
}

/** One row, from a server route. */
export async function logServer(userId: string | null, e: LogEvent) {
  await writeLog(userId, [{ ...e, surface: e.surface ?? "server" }], "server");
}
