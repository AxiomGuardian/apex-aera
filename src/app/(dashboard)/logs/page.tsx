"use client";

/**
 * Activity log. Everything people and AERA do, newest first, from the portal
 * and the phone. Filter it, watch it live, click a row for the raw detail.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PagePad } from "@/components/layout/PagePad";
import { RefreshCw, Play, Pause, ChevronDown, Search, AlertTriangle, Download } from "lucide-react";

type Row = {
  id: string;
  created_at: string;
  user_id: string | null;
  brand_id: string | null;
  surface: string;
  area: string | null;
  event: string;
  label: string | null;
  ok: boolean;
  ms: number | null;
  detail: Record<string, unknown>;
  session_id: string | null;
  app_version: string | null;
};

const AREAS = ["", "voice", "chat", "content", "queue", "brand", "auth", "nav", "connect", "system"];
const SURFACES = ["", "web", "ios", "server"];
const WINDOWS: { label: string; hours: number }[] = [
  { label: "Last hour", hours: 1 },
  { label: "Today", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "A week", hours: 168 },
  { label: "Everything", hours: 0 },
];

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return Math.floor(s) + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  if (s < 86400) return Math.floor(s / 3600) + "h ago";
  return Math.floor(s / 86400) + "d ago";
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: "America/Phoenix", hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export default function LogsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  const [area, setArea] = useState("");
  const [surface, setSurface] = useState("");
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [q, setQ] = useState("");
  const [hours, setHours] = useState(24);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ limit: "300" });
    if (area) p.set("area", area);
    if (surface) p.set("surface", surface);
    if (onlyErrors) p.set("only", "errors");
    if (q.trim()) p.set("q", q.trim());
    if (hours) p.set("since", new Date(Date.now() - hours * 3600 * 1000).toISOString());
    try {
      const r = await fetch("/api/logs?" + p.toString());
      const j = (await r.json()) as { rows?: Row[]; names?: Record<string, string> };
      setRows(j.rows ?? []);
      setNames(j.names ?? {});
    } catch { /* leave what is on screen */ }
    setLoading(false);
  }, [area, surface, onlyErrors, q, hours]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (live) timer.current = setInterval(() => void load(), 5000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [live, load]);

  const counts = useMemo(() => {
    const bad = rows.filter((r) => !r.ok).length;
    const people = new Set(rows.map((r) => r.user_id).filter(Boolean)).size;
    return { total: rows.length, bad, people };
  }, [rows]);

  const download = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "apex-activity-log.json"; a.click();
    URL.revokeObjectURL(url);
  };

  const select: React.CSSProperties = { padding: "8px 11px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" };

  return (
    <PagePad>
      <div className="flex flex-col gap-6 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
        <div>
          <p className="label-eyebrow mb-2.5">Diagnostics</p>
          <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>Activity log</h2>
          <p style={{ fontSize: 15, color: "var(--text-4)", marginTop: 12, lineHeight: 1.6, maxWidth: 560 }}>
            Every interaction, from the portal and the phone. Voice, dictation, uploads, queue changes, AERA&apos;s tools, sign ins, and anything that failed.
          </p>
        </div>

        {/* Filters */}
        <div className="mkt-card mkt-quiet" style={{ padding: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 200 }}>
            <Search style={{ width: 14, height: 14, color: "var(--text-6)", position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the label or the event"
              style={{ width: "100%", padding: "9px 11px 9px 32px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, outline: "none" }}
            />
          </div>

          <select value={area} onChange={(e) => setArea(e.target.value)} style={select}>
            {AREAS.map((a) => <option key={a} value={a}>{a || "Every area"}</option>)}
          </select>

          <select value={surface} onChange={(e) => setSurface(e.target.value)} style={select}>
            {SURFACES.map((a) => <option key={a} value={a}>{a || "Web and phone"}</option>)}
          </select>

          <select value={String(hours)} onChange={(e) => setHours(Number(e.target.value))} style={select}>
            {WINDOWS.map((w) => <option key={w.label} value={w.hours}>{w.label}</option>)}
          </select>

          <button
            onClick={() => setOnlyErrors((v) => !v)}
            className="dash-btn"
            style={{ ...select, display: "flex", alignItems: "center", gap: 6, color: onlyErrors ? "var(--rose)" : "var(--text-3)", borderColor: onlyErrors ? "rgba(251,113,133,0.45)" : "var(--border)", background: onlyErrors ? "rgba(251,113,133,0.08)" : "var(--surface-2)" }}
          >
            <AlertTriangle style={{ width: 13, height: 13 }} /> Only failures
          </button>

          <button onClick={() => setLive((v) => !v)} className="dash-btn" style={{ ...select, display: "flex", alignItems: "center", gap: 6, color: live ? "var(--cyan-text)" : "var(--text-3)", borderColor: live ? "var(--cyan-border)" : "var(--border)", background: live ? "var(--cyan-subtle)" : "var(--surface-2)" }}>
            {live ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />} {live ? "Live" : "Paused"}
          </button>

          <button onClick={() => void load()} className="dash-btn" style={{ ...select, display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw style={{ width: 13, height: 13 }} /> Refresh
          </button>

          <button onClick={download} className="dash-btn" style={{ ...select, display: "flex", alignItems: "center", gap: 6 }}>
            <Download style={{ width: 13, height: 13 }} /> JSON
          </button>
        </div>

        {/* Counts */}
        <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "var(--text-5)" }}>
          <span><strong style={{ color: "var(--text-2)" }}>{counts.total}</strong> events</span>
          <span><strong style={{ color: counts.bad ? "var(--rose)" : "var(--text-2)" }}>{counts.bad}</strong> failures</span>
          <span><strong style={{ color: "var(--text-2)" }}>{counts.people}</strong> {counts.people === 1 ? "person" : "people"}</span>
        </div>

        {/* Rows */}
        <div className="mkt-card mkt-quiet" style={{ padding: 0, overflow: "hidden" }}>
          {loading && <p style={{ padding: 20, fontSize: 13, color: "var(--text-5)" }}>Reading the log.</p>}
          {!loading && rows.length === 0 && <p style={{ padding: 20, fontSize: 13, color: "var(--text-5)" }}>Nothing in this window yet.</p>}

          {rows.map((r) => {
            const isOpen = open === r.id;
            return (
              <div key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <button
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="dash-row"
                  style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: r.ok ? "transparent" : "rgba(251,113,133,0.06)", border: "none", cursor: "pointer" }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: 999, flexShrink: 0, background: r.ok ? "var(--green)" : "var(--rose)" }} />
                  <span style={{ fontSize: 11.5, color: "var(--text-6)", width: 76, flexShrink: 0, fontFeatureSettings: '"tnum"' }}>{clock(r.created_at)}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: r.surface === "ios" ? "var(--cyan-text)" : "var(--text-5)", width: 52, flexShrink: 0 }}>{r.surface}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-5)", width: 132, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.event}</span>
                  <span style={{ fontSize: 13, color: "var(--text-2)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label ?? ""}</span>
                  <span style={{ fontSize: 11.5, color: "var(--text-5)", flexShrink: 0, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.user_id ? (names[r.user_id] ?? r.user_id.slice(0, 8)) : "signed out"}</span>
                  {r.ms != null && <span style={{ fontSize: 11, color: "var(--text-6)", width: 52, textAlign: "right", flexShrink: 0, fontFeatureSettings: '"tnum"' }}>{r.ms < 1000 ? r.ms + "ms" : (r.ms / 1000).toFixed(1) + "s"}</span>}
                  <span style={{ fontSize: 11, color: "var(--text-6)", width: 62, textAlign: "right", flexShrink: 0 }}>{ago(r.created_at)}</span>
                  <ChevronDown style={{ width: 13, height: 13, color: "var(--text-6)", flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>
                {isOpen && (
                  <pre style={{ margin: 0, padding: "12px 16px 16px 44px", fontSize: 11.5, lineHeight: 1.6, color: "var(--text-4)", background: "var(--surface-2)", overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
{JSON.stringify({ event: r.event, area: r.area, ok: r.ok, ms: r.ms, surface: r.surface, user_id: r.user_id, brand_id: r.brand_id, session_id: r.session_id, app_version: r.app_version, at: r.created_at, detail: r.detail }, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PagePad>
  );
}
