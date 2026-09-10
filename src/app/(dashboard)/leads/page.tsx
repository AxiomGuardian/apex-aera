"use client";

/**
 * Leads. Point it at a city and a trade, it goes looking for real local businesses
 * with weak social, and you work the list from here.
 */

import { useCallback, useEffect, useState } from "react";
import { PagePad } from "@/components/layout/PagePad";
import { Search, Loader2, Globe, Phone, Camera, Music2, ExternalLink } from "lucide-react";
import { log, logError } from "@/lib/log/client";

type Lead = {
  id: string;
  name: string;
  category: string | null;
  city: string | null;
  state: string | null;
  website: string | null;
  phone: string | null;
  instagram: string | null;
  tiktok: string | null;
  followers: number | null;
  presence: string | null;
  gap: string | null;
  pitch: string | null;
  score: number | null;
  status: string;
  notes: string | null;
  created_at: string;
};

const STATUSES = ["new", "contacted", "meeting", "won", "lost"] as const;
const STATUS_COLOR: Record<string, string> = {
  new: "var(--cyan)", contacted: "var(--amber)", meeting: "var(--violet)", won: "var(--green)", lost: "var(--text-6)",
};

function scoreColor(n: number) {
  if (n >= 75) return "var(--green)";
  if (n >= 50) return "var(--amber)";
  return "var(--text-5)";
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState("all");
  const [city, setCity] = useState("");
  const [industry, setIndustry] = useState("");
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/agency/leads?limit=200&status=" + filter);
      const j = (await r.json()) as { leads?: Lead[] };
      setLeads(j.leads ?? []);
    } catch { /* keep what is on screen */ }
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function findLeads() {
    if (!city.trim() || searching) return;
    setSearching(true); setNotice(null);
    const t0 = performance.now();
    try {
      const r = await fetch("/api/agency/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city, industry, count: 10 }),
      });
      const j = (await r.json()) as { ok?: boolean; added?: number; error?: string; note?: string };
      if (!r.ok || j.error) throw new Error(j.error ?? "Search failed");
      setNotice({ tone: "ok", text: j.added ? `Found ${j.added} new ${j.added === 1 ? "lead" : "leads"}.` : (j.note ?? "Nothing new.") });
      log("lead.search", { area: "leads", ms: performance.now() - t0, label: `Searched ${industry || "businesses"} in ${city}`, detail: { city, industry, added: j.added ?? 0 } });
      await load();
    } catch (e) {
      logError("lead.search", e, { area: "leads", ms: performance.now() - t0, label: `Search failed for ${city}` });
      setNotice({ tone: "bad", text: e instanceof Error ? e.message : "Search failed." });
    }
    setSearching(false);
  }

  async function setStatus(id: string, status: string) {
    setLeads((p) => p.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch("/api/agency/leads", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }),
    }).catch(() => null);
    log("lead.update", { area: "leads", label: "Moved a lead to " + status, detail: { id, status } });
  }

  const counts = STATUSES.map((s) => ({ s, n: leads.filter((l) => l.status === s).length }));

  return (
    <PagePad>
      <div className="flex flex-col gap-6 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
        <div>
          <p className="label-eyebrow mb-2.5">Growth</p>
          <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>Leads</h2>
          <p style={{ fontSize: 15, color: "var(--text-4)", marginTop: 12, lineHeight: 1.6, maxWidth: 560 }}>
            Name a city and a trade. AERA goes looking for real local businesses whose social is weak or missing, and tells you why each one is worth a call.
          </p>
        </div>

        {/* Search */}
        <div className="mkt-card mkt-line-cyan" style={{ padding: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <input
            value={city} onChange={(e) => setCity(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void findLeads(); }}
            placeholder="City or area, like Eloy AZ"
            style={{ flex: "1 1 200px", minWidth: 180, padding: "11px 13px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14, outline: "none" }}
          />
          <input
            value={industry} onChange={(e) => setIndustry(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void findLeads(); }}
            placeholder="Trade, like gyms or welders"
            style={{ flex: "1 1 200px", minWidth: 180, padding: "11px 13px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14, outline: "none" }}
          />
          <button
            onClick={() => void findLeads()} disabled={!city.trim() || searching}
            className="mkt-btn dash-btn"
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 10, background: "var(--cyan)", border: "none", color: "#04131a", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: !city.trim() || searching ? 0.5 : 1 }}
          >
            {searching ? <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} /> : <Search style={{ width: 15, height: 15 }} />}
            {searching ? "Looking" : "Find leads"}
          </button>
        </div>

        {searching && (
          <p style={{ fontSize: 13, color: "var(--text-5)" }}>
            Searching the live web and checking each business&apos;s accounts. This takes up to a minute.
          </p>
        )}

        {notice && (
          <div className="mkt-card" style={{ padding: "12px 15px", borderColor: notice.tone === "ok" ? "rgba(52,211,153,0.35)" : "rgba(251,113,133,0.35)" }}>
            <p style={{ fontSize: 13.5, color: notice.tone === "ok" ? "var(--green)" : "var(--rose)" }}>{notice.text}</p>
          </div>
        )}

        {/* Filter */}
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
          {["all", ...STATUSES].map((s) => (
            <button
              key={s} onClick={() => setFilter(s)}
              className="dash-btn"
              style={{
                padding: "7px 13px", borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                background: filter === s ? "var(--cyan-subtle)" : "var(--surface-2)",
                border: "1px solid " + (filter === s ? "var(--cyan-border)" : "var(--border)"),
                color: filter === s ? "var(--cyan)" : "var(--text-4)", textTransform: "capitalize",
              }}
            >
              {s}{s !== "all" && ` ${counts.find((c) => c.s === s)?.n ?? 0}`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading && <p style={{ fontSize: 13, color: "var(--text-5)" }}>Reading the pipeline.</p>}
        {!loading && leads.length === 0 && (
          <div className="mkt-card mkt-quiet" style={{ padding: 28, textAlign: "center" }}>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>No leads yet.</p>
            <p style={{ fontSize: 13, color: "var(--text-5)", marginTop: 6 }}>Put a city above and hit Find leads.</p>
          </div>
        )}

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {leads.map((l) => (
            <div key={l.id} className="mkt-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 15.5, fontWeight: 700, color: "var(--text)", lineHeight: 1.25 }}>{l.name}</p>
                  <p style={{ fontSize: 12, color: "var(--text-5)", marginTop: 2 }}>
                    {[l.category, [l.city, l.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 19, fontWeight: 800, color: scoreColor(l.score ?? 50), lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{l.score ?? 50}</p>
                  <p style={{ fontSize: 9, color: "var(--text-6)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>fit</p>
                </div>
              </div>

              {l.presence && <p style={{ fontSize: 12.5, color: "var(--text-4)", lineHeight: 1.55 }}>{l.presence}</p>}
              {l.gap && (
                <p style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.55, paddingLeft: 10, borderLeft: "2px solid var(--cyan-border)" }}>{l.gap}</p>
              )}
              {l.pitch && <p style={{ fontSize: 12.5, color: "var(--cyan-text)", lineHeight: 1.5, fontStyle: "italic" }}>&ldquo;{l.pitch}&rdquo;</p>}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 2 }}>
                {l.website && <a href={l.website.startsWith("http") ? l.website : "https://" + l.website} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-4)" }}><Globe style={{ width: 12, height: 12 }} /> Site <ExternalLink style={{ width: 9, height: 9 }} /></a>}
                {l.phone && <a href={"tel:" + l.phone} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-4)" }}><Phone style={{ width: 12, height: 12 }} /> {l.phone}</a>}
                {l.instagram && <a href={"https://instagram.com/" + l.instagram.replace(/^@/, "")} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-4)" }}><Camera style={{ width: 12, height: 12 }} /> {l.instagram}</a>}
                {l.tiktok && <a href={"https://tiktok.com/@" + l.tiktok.replace(/^@/, "")} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--text-4)" }}><Music2 style={{ width: 12, height: 12 }} /> {l.tiktok}</a>}
              </div>

              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                {STATUSES.map((s) => (
                  <button
                    key={s} onClick={() => void setStatus(l.id, s)}
                    className="dash-btn"
                    style={{
                      padding: "5px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                      background: l.status === s ? "color-mix(in srgb, " + STATUS_COLOR[s] + " 16%, transparent)" : "transparent",
                      border: "1px solid " + (l.status === s ? STATUS_COLOR[s] : "var(--border)"),
                      color: l.status === s ? STATUS_COLOR[s] : "var(--text-5)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </PagePad>
  );
}
