"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import {
  ArrowLeft, Loader2, CheckCircle2, Radar, FileText, Filter, RefreshCw,
  Camera, Share2, Users, Upload, CalendarClock, Link2, Mail, Sparkles, Archive, RotateCcw,
} from "lucide-react";

type Brand = {
  id: string; name: string; slug: string; status: string;
  tone_of_voice: string | null; target_audience: string | null; website_url: string | null;
  autopilot: boolean; created_at: string; archived_at: string | null;
};
type Member = { user_id: string; profiles: { email: string; full_name: string | null } | null };
type Asset  = { id: string; title: string | null; type: string; status: string; created_at: string };
type Conn   = { platform: string; status: string; account_name: string | null };
type Brief  = { id: string; niche: string | null; summary: string | null; created_at: string };
type Report = { id: string; summary: string | null; period_start: string | null; period_end: string | null; created_at: string };
type Funnel = { id: string; name: string; status: string; created_at: string };

function fmtMST(iso: string) {
  return new Date(iso).toLocaleString("en-US", { timeZone: "America/Phoenix", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " MST";
}

/* ---------- small building blocks ---------- */
function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 3, height: 14, borderRadius: 2, background: "linear-gradient(180deg, #2dd4ff, rgba(45,212,255,0.2))" }} />
        <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-2)" }}>{children}</h3>
      </div>
      {hint && <p style={{ fontSize: 12.5, color: "var(--text-5)", marginTop: 6, lineHeight: 1.6, paddingLeft: 13 }}>{hint}</p>}
    </div>
  );
}

function Field({ label, hint, value, onChange, placeholder, textarea }: { label: string; hint: string; value: string; onChange: (v: string) => void; placeholder: string; textarea?: boolean }) {
  return (
    <div>
      <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-3)", display: "block", marginBottom: 4 }}>{label}</label>
      <p style={{ fontSize: 12, color: "var(--text-6)", marginBottom: 8, lineHeight: 1.5 }}>{hint}</p>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="auth-input" style={{ fontSize: 14, resize: "vertical" }} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="auth-input" style={{ fontSize: 14 }} />
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone?: "ok" | "warn" | "muted" }) {
  const color = tone === "ok" ? "#34D399" : tone === "warn" ? "#fbbf24" : "var(--text-2)";
  return (
    <div className="mkt-card mkt-quiet" style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      <div className="dash-chip" style={{ width: 36, height: 36, borderRadius: 10 }}>
        <Icon style={{ width: 15, height: 15, color: "var(--cyan)" }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, color: "var(--text-6)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>{label}</p>
        <p style={{ fontSize: 15, fontWeight: 800, color, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</p>
      </div>
    </div>
  );
}

/* ---------- the workspace ---------- */
export function BrandWorkspace({ brandId, mode }: { brandId: string; mode: "agency" | "enterprise" | "client" }) {
  const id = brandId;
  const agency = mode === "agency" || mode === "enterprise";
  const canDelete = mode === "agency";
  const router = useRouter();

  const [brand, setBrand] = useState<Brand | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [conns, setConns] = useState<Conn[]>([]);
  const [assetCount, setAssetCount] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [autopilot, setAutopilot] = useState(true);
  const [flipping, setFlipping] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [busy, setBusy] = useState<"" | "trends" | "report" | "funnel">("");
  const [engineErr, setEngineErr] = useState("");
  const [delStep, setDelStep] = useState<0 | 1 | 2>(0);
  const [delErr, setDelErr] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [b, m, a, c, t, r, f, ac, sc] = await Promise.all([
      supabase.from("brands").select("*").eq("id", id).single(),
      supabase.from("brand_members").select("user_id,profiles(email,full_name)").eq("brand_id", id),
      supabase.from("content_assets").select("id,title,type,status,created_at").eq("brand_id", id).order("created_at", { ascending: false }).limit(8),
      supabase.from("platform_connections").select("platform,status,account_name").eq("brand_id", id),
      supabase.from("trend_briefs").select("id,niche,summary,created_at").eq("brand_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("reports").select("id,summary,period_start,period_end,created_at").eq("brand_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("funnels").select("id,name,status,created_at").eq("brand_id", id).order("created_at", { ascending: false }).limit(5),
      supabase.from("content_assets").select("id", { count: "exact", head: true }).eq("brand_id", id),
      supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("brand_id", id).in("status", ["approved", "locked", "proposed"]),
    ]);
    if (b.data) {
      const br = b.data as Brand;
      setBrand(br);
      setTone(br.tone_of_voice ?? "");
      setAudience(br.target_audience ?? "");
      setWebsite(br.website_url ?? "");
      setAutopilot(br.autopilot !== false);
    }
    setMembers((m.data ?? []) as unknown as Member[]);
    setAssets((a.data ?? []) as Asset[]);
    setConns((c.data ?? []) as Conn[]);
    setBrief((t.data ?? null) as Brief | null);
    setReport((r.data ?? null) as Report | null);
    setFunnels((f.data ?? []) as Funnel[]);
    setAssetCount(ac.count ?? 0);
    setScheduledCount(sc.count ?? 0);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function saveProfile() {
    setSaving(true); setSaved(false);
    const supabase = createClient();
    await supabase.from("brands").update({ tone_of_voice: tone || null, target_audience: audience || null, website_url: website || null }).eq("id", id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function toggleAutopilot() {
    const next = !autopilot;
    setFlipping(true); setAutopilot(next);
    const supabase = createClient();
    const { error } = await supabase.from("brands").update({ autopilot: next }).eq("id", id);
    if (error) setAutopilot(!next);
    setFlipping(false);
  }

  async function runEngine(kind: "trends" | "report" | "funnel", url: string) {
    setBusy(kind); setEngineErr("");
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId: id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Engine failed");
      await load();
    } catch (err) {
      setEngineErr(err instanceof Error ? err.message : "Engine failed");
    } finally { setBusy(""); }
  }

  async function sendInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteBusy(true); setInviteMsg("");
    try {
      const res = await fetch("/api/agency/invite-member", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId: id, email: inviteEmail }) });
      const j = (await res.json()) as { ok?: boolean; error?: string; warning?: string; link?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Invite failed");
      setInviteMsg(j.warning ?? ("Invite sent to " + inviteEmail + "."));
      setInviteEmail("");
      await load();
    } catch (err) {
      setInviteMsg(err instanceof Error ? err.message : "Invite failed");
    } finally { setInviteBusy(false); }
  }

  async function lifecycle(action: "archive" | "restore" | "delete") {
    setDelStep(2); setDelErr("");
    try {
      const res = await fetch("/api/agency/clients/" + action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brandId: id }) });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Failed");
      if (action === "delete") { router.push("/clients"); router.refresh(); return; }
      setDelStep(0);
      await load();
    } catch (err) {
      setDelErr(err instanceof Error ? err.message : "Failed");
      setDelStep(0);
    }
  }

  const btn: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 18px", borderRadius: 11,
    background: "rgba(45,212,255,0.10)", border: "1px solid rgba(45,212,255,0.28)",
    color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer",
  };
  const card: React.CSSProperties = { padding: "26px 28px", borderRadius: 20 };

  if (!brand) {
    return (
      <PagePad>
        <div style={{ padding: 80, textAlign: "center" }}>
          <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "var(--text-5)", margin: "0 auto" }} />
        </div>
      </PagePad>
    );
  }

  const ig = conns.find((c) => c.platform === "instagram");
  const fb = conns.find((c) => c.platform === "facebook");
  const connectedCount = conns.filter((c) => c.status === "connected").length;
  const initials = brand.name.replace(/[^A-Za-z0-9 ]/g, "").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "B";

  return (
    <PagePad>
      <div className="flex flex-col gap-8 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>

        {/* ── Header ── */}
        <div>
          {agency ? (
            <button onClick={() => router.push("/clients")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-5)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18 }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> All clients
            </button>
          ) : (
            <p className="label-eyebrow mb-3">My Brand</p>
          )}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div className="auth-mark" style={{ width: 64, height: 64 }}>
                <span className="mkt-gradient-text" style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.04em" }}>{initials}</span>
              </div>
              <div>
                <h2 style={{ fontSize: "clamp(28px,4vw,38px)", fontWeight: 900, letterSpacing: "-0.04em", color: "var(--text)", lineHeight: 1 }}>{brand.name}</h2>
                <p style={{ fontSize: 13, color: "var(--text-5)", marginTop: 8 }}>
                  Workspace since {new Date(brand.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 14px", borderRadius: 20, color: brand.status === "archived" ? "#fbbf24" : "#34D399", background: brand.status === "archived" ? "rgba(251,191,36,0.08)" : "rgba(52,211,153,0.08)", border: "1px solid " + (brand.status === "archived" ? "rgba(251,191,36,0.25)" : "rgba(52,211,153,0.22)") }}>
                {brand.status}
              </span>
            </div>
          </div>
        </div>

        {brand.status === "archived" && brand.archived_at && (
          <div className="mkt-card mkt-line-amber" style={{ padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#fbbf24" }}>Archived {new Date(brand.archived_at).toLocaleDateString()}</p>
              <p style={{ fontSize: 13, color: "var(--text-4)", marginTop: 4, lineHeight: 1.5 }}>
                Everything is kept intact and AERA is paused. Permanent deletion happens automatically {Math.max(0, 30 - Math.floor((Date.now() - new Date(brand.archived_at).getTime()) / 86400000))} days from now unless restored.
              </p>
            </div>
            {canDelete && (
              <button onClick={() => void lifecycle("restore")} disabled={delStep === 2} className="mkt-btn dash-btn" style={{ ...btn, background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.3)", color: "#34D399" }}>
                <RotateCcw style={{ width: 13, height: 13 }} /> Restore client
              </button>
            )}
          </div>
        )}

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat icon={Link2} label="Connected" value={connectedCount === 0 ? "No platforms" : connectedCount + (connectedCount === 1 ? " platform" : " platforms")} tone={connectedCount ? "ok" : "warn"} />
          <Stat icon={Upload} label="Content" value={assetCount + (assetCount === 1 ? " asset" : " assets")} />
          <Stat icon={CalendarClock} label="Scheduled" value={scheduledCount + (scheduledCount === 1 ? " post" : " posts")} />
          <Stat icon={Sparkles} label="Mode" value={autopilot ? "Autopilot" : "Manual approval"} tone={autopilot ? "ok" : "warn"} />
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ── Left: Autopilot + Voice ── */}
          <div className="lg:col-span-3 flex flex-col gap-6">
            {/* Autopilot */}
            <div className="mkt-card mkt-line-cyan" style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: autopilot ? "linear-gradient(135deg, rgba(52,211,153,0.07), rgba(20,22,26,0.7))" : "linear-gradient(135deg, rgba(251,191,36,0.07), rgba(20,22,26,0.7))" }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 800, color: autopilot ? "#34D399" : "#fbbf24", letterSpacing: "-0.01em" }}>
                  {autopilot ? "Autopilot is on" : "Manual approval"}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-4)", marginTop: 5, lineHeight: 1.6, maxWidth: 460 }}>
                  {autopilot
                    ? "AERA writes, schedules, and publishes on its own. Anything can be pulled from the Queue before it goes out."
                    : "Every post waits in the Queue for a yes before it publishes."}
                </p>
              </div>
              <button onClick={() => void toggleAutopilot()} disabled={flipping} aria-label="Toggle autopilot"
                style={{ position: "relative", width: 56, height: 30, borderRadius: 999, flexShrink: 0, cursor: "pointer", border: "none", background: autopilot ? "rgba(52,211,153,0.6)" : "rgba(255,255,255,0.14)", transition: "background 0.25s", boxShadow: autopilot ? "0 0 20px rgba(52,211,153,0.3)" : "none" }}>
                <span style={{ position: "absolute", top: 3, left: autopilot ? 29 : 3, width: 24, height: 24, borderRadius: "50%", background: "#fff", transition: "left 0.25s", boxShadow: "0 2px 6px rgba(0,0,0,0.4)" }} />
              </button>
            </div>

            {/* Brand voice */}
            <div className="mkt-card mkt-quiet" style={card}>
              <SectionTitle hint="AERA reads these three lines before it writes a single caption. They are the difference between generic and unmistakably you.">
                Brand voice
              </SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <Field label="Tone of voice" hint="How you talk. Three to five words is plenty." value={tone} onChange={setTone} placeholder="Bold, direct, a little playful. Never corporate." />
                <Field label="Who you are talking to" hint="The person AERA should picture on the other side of the screen." value={audience} onChange={setAudience} placeholder="Gun owners 25 to 45 who take training seriously and want to get sharper." textarea />
                <Field label="Website" hint="AERA links here when it makes sense, and reads it for context." value={website} onChange={setWebsite} placeholder="https://" />
                <button onClick={() => void saveProfile()} disabled={saving} className="mkt-btn dash-btn" style={{ ...btn, justifyContent: "center", padding: "13px 20px", fontSize: 14 }}>
                  {saving ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : saved ? <CheckCircle2 style={{ width: 14, height: 14 }} /> : null}
                  {saved ? "Saved" : saving ? "Saving" : "Save voice"}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Connections + Team ── */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="mkt-card mkt-quiet" style={card}>
              <SectionTitle hint="Where AERA publishes. Instagram connects with your Instagram login, no Facebook needed.">
                Platforms
              </SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { key: "instagram", label: "Instagram", icon: Camera, conn: ig, href: "/api/aera/connect/instagram?brandId=" + id },
                  { key: "facebook", label: "Facebook Page", icon: Share2, conn: fb, href: "/api/aera/connect/meta?brandId=" + id },
                ].map((p) => {
                  const ok = p.conn?.status === "connected";
                  const expired = p.conn?.status === "expired";
                  return (
                    <div key={p.key} className="dash-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 12, border: "1px solid " + (ok ? "rgba(52,211,153,0.22)" : "var(--border)"), background: ok ? "rgba(52,211,153,0.05)" : "var(--surface-2)" }}>
                      <p.icon style={{ width: 17, height: 17, color: ok ? "#34D399" : "var(--text-4)" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{p.label}</p>
                        <p style={{ fontSize: 12, color: ok ? "#34D399" : expired ? "#fbbf24" : "var(--text-6)", marginTop: 2 }}>
                          {ok ? "Connected " + (p.conn?.account_name ?? "") : expired ? "Expired. Reconnect." : "Not connected"}
                        </p>
                      </div>
                      <a href={p.href} className="mkt-btn dash-btn" style={{ ...btn, padding: "8px 13px", fontSize: 12, textDecoration: "none" }}>
                        {ok ? "Reconnect" : "Connect"}
                      </a>
                    </div>
                  );
                })}
                <p style={{ fontSize: 12, color: "var(--text-6)", marginTop: 4, lineHeight: 1.5 }}>TikTok, YouTube, and LinkedIn are next in line.</p>
              </div>
            </div>

            <div className="mkt-card mkt-quiet" style={card}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <SectionTitle hint={members.length + (members.length === 1 ? " person has" : " people have") + " access to this workspace."}>Team</SectionTitle>
                {agency && (
                  <button onClick={() => setInviteOpen((o) => !o)} className="mkt-btn dash-btn" style={{ ...btn, padding: "8px 12px", fontSize: 12 }}>
                    <Mail style={{ width: 12, height: 12 }} /> Invite
                  </button>
                )}
              </div>
              {inviteOpen && agency && (
                <form onSubmit={sendInvite} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@business.com" required className="auth-input" style={{ padding: "10px 12px", fontSize: 13 }} />
                  <button type="submit" disabled={inviteBusy} className="mkt-btn dash-btn" style={{ ...btn, padding: "10px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
                    {inviteBusy ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> : "Send"}
                  </button>
                </form>
              )}
              {inviteMsg && <p style={{ fontSize: 12, color: "var(--cyan)", marginBottom: 10 }}>{inviteMsg}</p>}
              {members.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-6)" }}>{agency ? "No members yet." : "Just you so far."}</p>
              ) : members.map((m) => (
                <div key={m.user_id} className="dash-row" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 6px", borderRadius: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.22)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "var(--cyan)" }}>
                    {(m.profiles?.full_name || m.profiles?.email || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-2)" }}>{m.profiles?.full_name || m.profiles?.email}</p>
                    {m.profiles?.full_name && <p style={{ fontSize: 12, color: "var(--text-6)", marginTop: 1 }}>{m.profiles.email}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Intelligence ── */}
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
            <SectionTitle hint="What AERA has learned about this brand and its market.">AERA Intelligence</SectionTitle>
            {engineErr && <span style={{ fontSize: 12, color: "#f87171" }}>{engineErr}</span>}
          </div>
          <div className="grid lg:grid-cols-3 gap-5">
            <div className="mkt-card mkt-quiet" style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div className="dash-chip" style={{ width: 34, height: 34, borderRadius: 10 }}><Radar style={{ width: 15, height: 15, color: "var(--cyan)" }} /></div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-2)" }}>Trend brief</p>
              </div>
              {brief ? (
                <>
                  {brief.niche && <p style={{ fontSize: 12.5, color: "var(--cyan)", marginBottom: 8, fontWeight: 700 }}>{brief.niche}</p>}
                  <p style={{ fontSize: 13.5, color: "var(--text-4)", lineHeight: 1.65, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{brief.summary ?? "Brief generated."}</p>
                  <p style={{ fontSize: 12, color: "var(--text-6)", marginBottom: 16 }}>Researched {fmtMST(brief.created_at)}</p>
                </>
              ) : (
                <p style={{ fontSize: 13.5, color: "var(--text-5)", lineHeight: 1.65, marginBottom: 16 }}>No research yet. AERA scans the live web and X for what is moving in this niche.</p>
              )}
              <button onClick={() => void runEngine("trends", "/api/aera/trends")} disabled={busy !== ""} className="mkt-btn dash-btn" style={{ ...btn, opacity: busy && busy !== "trends" ? 0.5 : 1 }}>
                {busy === "trends" ? <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> : <RefreshCw style={{ width: 13, height: 13 }} />}
                {busy === "trends" ? "Researching" : brief ? "Refresh brief" : "Research now"}
              </button>
            </div>

            <div className="mkt-card mkt-quiet" style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div className="dash-chip" style={{ width: 34, height: 34, borderRadius: 10 }}><FileText style={{ width: 15, height: 15, color: "var(--cyan)" }} /></div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-2)" }}>Weekly report</p>
              </div>
              {report ? (
                <>
                  <p style={{ fontSize: 13.5, color: "var(--text-4)", lineHeight: 1.65, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{report.summary ?? "Report generated."}</p>
                  <p style={{ fontSize: 12, color: "var(--text-6)", marginBottom: 16 }}>{report.period_start && report.period_end ? report.period_start + " to " + report.period_end : "Generated " + fmtMST(report.created_at)}</p>
                </>
              ) : (
                <p style={{ fontSize: 13.5, color: "var(--text-5)", lineHeight: 1.65, marginBottom: 16 }}>No reports yet. Built only from real activity. AERA never invents a number.</p>
              )}
              <button onClick={() => void runEngine("report", "/api/reports/generate")} disabled={busy !== ""} className="mkt-btn dash-btn" style={{ ...btn, opacity: busy && busy !== "report" ? 0.5 : 1 }}>
                {busy === "report" ? <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> : null}
                {busy === "report" ? "Writing" : "Generate report"}
              </button>
            </div>

            <div className="mkt-card mkt-quiet" style={card}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div className="dash-chip" style={{ width: 34, height: 34, borderRadius: 10 }}><Filter style={{ width: 15, height: 15, color: "var(--cyan)" }} /></div>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-2)" }}>Funnels</p>
              </div>
              {funnels.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "var(--text-5)", lineHeight: 1.65, marginBottom: 16 }}>No funnels yet. AERA can sketch a landing page structure from this brand&apos;s voice.</p>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  {funnels.map((f, i) => (
                    <div key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderBottom: i < funnels.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <p style={{ fontSize: 13.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</p>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "2px 8px", borderRadius: 20, color: "var(--text-5)", background: "var(--surface-2)", border: "1px solid var(--border)", flexShrink: 0 }}>{f.status}</span>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => void runEngine("funnel", "/api/aera/funnel")} disabled={busy !== ""} className="mkt-btn dash-btn" style={{ ...btn, opacity: busy && busy !== "funnel" ? 0.5 : 1 }}>
                {busy === "funnel" ? <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> : null}
                {busy === "funnel" ? "Drafting" : "Draft funnel"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Recent content ── */}
        <div className="mkt-card mkt-quiet rounded-[20px] overflow-hidden">
          <div className="px-7 py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <SectionTitle>Recent content</SectionTitle>
            <button onClick={() => router.push("/content")} style={{ background: "none", border: "none", color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Open Content →</button>
          </div>
          {assets.length === 0 ? (
            <p style={{ padding: 30, fontSize: 14, color: "var(--text-6)", textAlign: "center" }}>Nothing uploaded yet. The first video kicks everything off.</p>
          ) : assets.map((a, i) => (
            <div key={a.id} className="dash-row" style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 28px", borderBottom: i < assets.length - 1 ? "1px solid var(--border)" : "none" }}>
              <p style={{ flex: 1, fontSize: 14, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title ?? "Untitled"}</p>
              <span style={{ fontSize: 12, color: "var(--text-5)" }}>{a.type.replace("_", " ")}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: "var(--cyan)", background: "rgba(45,212,255,0.07)", border: "1px solid rgba(45,212,255,0.16)" }}>{a.status}</span>
            </div>
          ))}
        </div>

        {/* ── Danger zone ── */}
        {canDelete && brand.status !== "archived" && (
          <div style={{ padding: "22px 26px", borderRadius: 20, border: "1px solid rgba(251,191,36,0.18)", background: "rgba(251,191,36,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#fbbf24", letterSpacing: "0.08em", textTransform: "uppercase" }}>Archive this client</p>
                <p style={{ fontSize: 13, color: "var(--text-5)", marginTop: 5, lineHeight: 1.6, maxWidth: 560 }}>
                  Pauses AERA and hides the workspace, but keeps everything for 30 days. Restore any time in that window. After 30 days it is deleted for good.
                </p>
                {delErr && <p style={{ fontSize: 12, color: "#fb7185", marginTop: 6 }}>{delErr}</p>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {delStep === 1 && (
                  <button onClick={() => setDelStep(0)} style={{ padding: "10px 16px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                )}
                <button onClick={() => (delStep === 0 ? setDelStep(1) : delStep === 1 ? void lifecycle("archive") : null)} disabled={delStep === 2}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 11, background: delStep === 1 ? "rgba(251,191,36,0.9)" : "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.35)", color: delStep === 1 ? "#1a1204" : "#fbbf24", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {delStep === 2 ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> : <Archive style={{ width: 13, height: 13 }} />}
                  {delStep === 0 ? "Archive client" : delStep === 1 ? "Yes, archive " + brand.name : "Archiving"}
                </button>
              </div>
            </div>
          </div>
        )}
        {canDelete && (
          <div style={{ padding: "22px 26px", borderRadius: 20, border: "1px solid rgba(251,113,133,0.18)", background: "rgba(251,113,133,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#fb7185", letterSpacing: "0.08em", textTransform: "uppercase" }}>Delete permanently</p>
                <p style={{ fontSize: 13, color: "var(--text-5)", marginTop: 5, lineHeight: 1.6, maxWidth: 560 }}>
                  No 30-day window. Removes the workspace, all content, posts, reports, chats, and any client accounts attached only to this brand. Cannot be undone.
                </p>
                {delErr && <p style={{ fontSize: 12, color: "#fb7185", marginTop: 6 }}>{delErr}</p>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {delStep === 1 && (
                  <button onClick={() => setDelStep(0)} style={{ padding: "10px 16px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                )}
                <button onClick={() => (delStep === 0 ? setDelStep(1) : delStep === 1 ? void lifecycle("delete") : null)} disabled={delStep === 2}
                  style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "10px 18px", borderRadius: 11, background: delStep === 1 ? "rgba(251,113,133,0.9)" : "rgba(251,113,133,0.10)", border: "1px solid rgba(251,113,133,0.35)", color: delStep === 1 ? "#1a0509" : "#fb7185", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  {delStep === 2 ? <Loader2 className="animate-spin" style={{ width: 12, height: 12 }} /> : null}
                  {delStep === 0 ? "Delete permanently" : delStep === 1 ? "Yes, delete " + brand.name + " forever" : "Deleting"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PagePad>
  );
}
