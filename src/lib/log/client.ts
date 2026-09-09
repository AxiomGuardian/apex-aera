"use client";

/**
 * The activity log, browser side.
 *
 * log("voice.open", { area: "voice", label: "Opened the voice layer" })
 *
 * Events queue for a moment and go up in one batch, so a busy screen does not
 * fire a request per click. The queue also flushes when the tab is hidden or
 * closed, so the last thing someone did before a crash still lands.
 */

export type ClientLogEvent = {
  area?: string;
  label?: string;
  ok?: boolean;
  ms?: number;
  detail?: Record<string, unknown>;
  brandId?: string | null;
};

type Queued = ClientLogEvent & { event: string; at: string; sessionId: string };

const FLUSH_MS = 1500;
const MAX_QUEUE = 40;

let queue: Queued[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let bound = false;

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  try {
    let id = sessionStorage.getItem("apex_log_session");
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("apex_log_session", id); }
    return id;
  } catch {
    return "no-storage";
  }
}

function bind() {
  if (bound || typeof window === "undefined") return;
  bound = true;
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });
  window.addEventListener("pagehide", () => flush(true));
}

export function flush(beacon = false) {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length || typeof window === "undefined") return;
  const events = queue;
  queue = [];
  const body = JSON.stringify({ surface: "web", events });
  try {
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon("/api/log", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
  } catch {
    // Never let logging surface an error to the person.
  }
}

/** Records one thing that happened. Fire and forget. */
export function log(event: string, e: ClientLogEvent = {}) {
  if (typeof window === "undefined") return;
  bind();
  queue.push({ ...e, event, at: new Date().toISOString(), sessionId: sessionId() });
  if (queue.length >= MAX_QUEUE) { flush(); return; }
  if (!timer) timer = setTimeout(() => flush(), FLUSH_MS);
}

/** Records something that failed, with the message attached. */
export function logError(event: string, err: unknown, e: ClientLogEvent = {}) {
  const message = err instanceof Error ? err.message : String(err);
  log(event, { ...e, ok: false, detail: { ...(e.detail ?? {}), error: message.slice(0, 500) } });
}

/** Times an async step and logs how long it took, success or failure. */
export async function logged<T>(event: string, e: ClientLogEvent, run: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    const out = await run();
    log(event, { ...e, ms: performance.now() - t0 });
    return out;
  } catch (err) {
    logError(event, err, { ...e, ms: performance.now() - t0 });
    throw err;
  }
}
