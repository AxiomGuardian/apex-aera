"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * What APEX has done for this brand: a before/after review with a month-by-month chart.
 * Reads real counts; platform reach fills in once the metrics engine is collecting.
 */
type Month = { key: string; label: string; uploaded: number; published: number; byPlatform: Record<string, number>; reach: number; engagement: number; views: number };
type Impact = {
  brand: { name: string; joined: string };
  baseline: { posts_per_month?: number; followers?: Record<string, number>; notes?: string };
  hasMetrics: boolean; timeline: Month[];
  totals: { uploaded: number; published: number; reach: number; engagement: number; views: number };
  followers: Record<string, number>; narrative: string;
};

const P: Record<string, string> = { instagram: "#2DD4FF", tiktok: "#A78BFA", facebook: "#60A5FA", youtube: "#FB7185", linkedin: "#34D399" };

export function ImpactReport({ brandId, canEditBaseline }: { brandId: string; canEditBaseline: boolean }) {
  const [data, setData] = useState<Impact | null>(null);
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [bPosts, setBPosts] = useState("");
  const [bIg, setBIg] = useState("");
  const [bTt, setBTt] = useState("");
  const [bNotes, setBNotes] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/aera/impact?brandId=${brandId}&months=${months}`);
    const j = (await r.json()) as Impact;
    setData(j);
    setBPosts(j.baseline?.posts_per_month?.toString() ?? ""); setBIg(j.baseline?.followers?.instagram?.toString() ?? ""); setBTt(j.baseline?.followers?.tiktok?.toString() ?? ""); setBNotes(j.baseline?.notes ?? "");
    setLoading(false);
  }
  useEffect(() => { void load(); }, [brandId, months]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveBaseline() {
    const baseline = { posts_per_month: bPosts ? Number(bPosts) : undefined, followers: { ...(bIg ? { instagram: Number(bIg) } : {}), ...(bTt ? { tiktok: Number(bTt) } : {}) }, notes: bNotes || undefined };
    await createClient().from("brands").update({ baseline, baseline_captured_at: new Date().toISOString() }).eq("id", brandId);
    setEdit(false); void load();
  }

  const max = Math.max(1, ...(data?.timeline.map((m) => Math.max(m.published, m.uploaded)) ?? [1]));
  const platforms = Array.from(new Set((data?.timeline ?? []).flatMap((m) => Object.keys(m.byPlatform))));

  return (
    <div className="mkt-card mkt-line-cyan" style={{ padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <p className="section-label" style={{ marginBottom: 6 }}>What APEX has done for you</p>
          <p style={{ fontSize: 13, color: "var(--text-4)" }}>Where you started, and where AERA has taken it since.</p>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[3, 6, 12].map((n) => (
            <button key={n} onClick={() => setMonths(n)} style={{ padding: "6px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: months === n ? "var(--cyan-subtle)" : "transparent", border: "1px solid " + (months === n ? "var(--cyan-border)" : "var(--border)"), color: months === n ? "var(--cyan)" : "var(--text-4)" }}>{n} mo</button>
          ))}
          <button onClick={() => void load()} title="Refresh" style={{ padding: "6px 9px", borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--text-4)", cursor: "pointer" }}><RefreshCw style={{ width: 12, height: 12 }} /></button>
        </div>
      </div>

      {loading || !data ? (
        <div style={{ padding: 30, textAlign: "center" }}><Loader2 className="animate-spin" style={{ width: 16, height: 16, color: "var(--text-5)", margin: "0 auto" }} /></div>
      ) : (
        <>
          {/* Before / after tiles */}
          <div className="grid sm:grid-cols-4 gap-3" style={{ marginTop: 14 }}>
            <Tile label="Before APEX" value={data.baseline.posts_per_month != null ? `${data.baseline.posts_per_month}/mo` : "not set"} sub="posting cadence" muted />
            <Tile label="Published by AERA" value={String(data.totals.published)} sub={`last ${months} months`} />
            <Tile label="Content in" value={String(data.totals.uploaded)} sub="uploads" />
            <Tile label={data.hasMetrics ? "Reach" : "Reach"} value={data.hasMetrics ? data.totals.reach.toLocaleString() : "soon"} sub={data.hasMetrics ? `${data.totals.engagement.toLocaleString()} engagements` : "metrics engine next"} muted={!data.hasMetrics} />
          </div>

          {/* Chart */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150, padding: "0 4px", borderBottom: "1px solid var(--border)" }}>
              {data.timeline.map((m) => (
                <div key={m.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 3, width: "100%", height: "100%", justifyContent: "center" }}>
                    <div title={`${m.uploaded} uploaded`} style={{ width: "34%", height: `${(m.uploaded / max) * 100}%`, minHeight: m.uploaded ? 4 : 0, borderRadius: "6px 6px 0 0", background: "var(--surface-4)" }} />
                    <div title={`${m.published} published`} style={{ width: "34%", height: `${(m.published / max) * 100}%`, minHeight: m.published ? 4 : 0, borderRadius: "6px 6px 0 0", background: "linear-gradient(180deg, var(--cyan), var(--cyan-dim))", boxShadow: "0 0 18px rgba(45,212,255,0.25)" }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, padding: "8px 4px 0" }}>
              {data.timeline.map((m) => <p key={m.key} style={{ flex: 1, textAlign: "center", fontSize: 11, color: "var(--text-5)" }}>{m.label}</p>)}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
              <Legend color="var(--surface-4)" label="Uploaded" />
              <Legend color="var(--cyan)" label="Published by AERA" />
              {platforms.map((p) => <Legend key={p} color={P[p] ?? "var(--text-4)"} label={`${p[0].toUpperCase()}${p.slice(1)}: ${data.timeline.reduce((n, m) => n + (m.byPlatform[p] ?? 0), 0)}`} />)}
            </div>
          </div>

          {/* Narrative */}
          {data.narrative && (
            <p style={{ marginTop: 18, fontSize: 14.5, lineHeight: 1.7, color: "var(--text-2)", padding: "14px 16px", borderRadius: 12, background: "var(--cyan-subtle)", border: "1px solid var(--cyan-border)" }}>{data.narrative}</p>
          )}

          {/* Baseline */}
          {canEditBaseline && (
            <div style={{ marginTop: 16 }}>
              {!edit ? (
                <button onClick={() => setEdit(true)} style={{ background: "none", border: "none", color: "var(--cyan)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}>
                  {data.baseline.posts_per_month != null ? "Edit the before picture" : "Record where they started (posts per month, followers)"}
                </button>
              ) : (
                <div className="grid sm:grid-cols-4 gap-8" style={{ gap: 10, alignItems: "end" }}>
                  <Field label="Posts / month before" value={bPosts} set={setBPosts} placeholder="e.g. 2" />
                  <Field label="Instagram followers" value={bIg} set={setBIg} placeholder="e.g. 1200" />
                  <Field label="TikTok followers" value={bTt} set={setBTt} placeholder="e.g. 300" />
                  <Field label="Notes" value={bNotes} set={setBNotes} placeholder="no consistent posting" />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => void saveBaseline()} className="dash-btn" style={{ padding: "9px 14px", borderRadius: 9, background: "rgba(45,212,255,0.1)", border: "1px solid rgba(45,212,255,0.3)", color: "var(--cyan)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Save</button>
                    <button onClick={() => setEdit(false)} style={{ padding: "9px 14px", borderRadius: 9, background: "transparent", border: "1px solid var(--border)", color: "var(--text-4)", fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, muted }: { label: string; value: string; sub: string; muted?: boolean }) {
  return (
    <div style={{ padding: "14px 16px", borderRadius: 14, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
      <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-5)" }}>{label}</p>
      <p className={muted ? "" : "dash-num"} style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", marginTop: 4, color: muted ? "var(--text-4)" : "var(--text)" }}>{value}</p>
      <p style={{ fontSize: 11.5, color: "var(--text-5)", marginTop: 2 }}>{sub}</p>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-4)" }}><span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />{label}</span>;
}
function Field({ label, value, set, placeholder }: { label: string; value: string; set: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 5 }}>{label}</label>
      <input value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} style={{ width: "100%", padding: "9px 11px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, outline: "none" }} />
    </div>
  );
}
