"use client";

/**
 * Notes every screen the person opens, and anything the browser throws.
 * Mounted once in the portal shell.
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { log, logError } from "@/lib/log/client";

export function ActivityLogger() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);
  const opened = useRef<number>(Date.now());

  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    const from = last.current;
    const stayed = from ? Date.now() - opened.current : undefined;
    last.current = pathname;
    opened.current = Date.now();
    log("nav.page", { area: "nav", label: "Opened " + pathname, detail: { path: pathname, from }, ms: stayed });
  }, [pathname]);

  useEffect(() => {
    const onError = (e: ErrorEvent) => logError("app.error", e.error ?? e.message, { area: "system", label: "Uncaught error", detail: { path: window.location.pathname, source: e.filename, line: e.lineno } });
    const onReject = (e: PromiseRejectionEvent) => logError("app.error", e.reason, { area: "system", label: "Unhandled promise", detail: { path: window.location.pathname } });
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);

  return null;
}
