"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import { ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";

type Brand = {
  id: string; name: string; slug: string; status: string;
  tone_of_voice: string | null; target_audience: string | null; website_url: string | null;
  created_at: string;
};
type Member = { user_id: string; profiles: { email: string; full_name: string | null } | null };
type Asset  = { id: string; title: string | null; type: string; status: string; created_at: string };
type Conn   = { platform: string; status: string; account_name: string | null };

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [brand,   setBrand]   = useState<Brand | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assets,  setAssets]  = useState<Asset[]>([]);
  const [conns,   setConns]   = useState<Conn[]>([]);
  const [tone,     setTone]     = useState("");
  const [audience, setAudience] = useState("");
  const [website,  setWebsite]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [b, m, a, c] = await Promise.all([
      supabase.from("brands").select("*").eq("id", id).single(),
      supabase.from("brand_members").select("user_id,profiles(email,full_name)").eq("brand_id", id),
      supabase.from("content_assets").select("id,title,type,status,created_at").eq("brand_id", id).order("created_at", { ascending: false }).limit(10),
      supabase.from("platform_connections").select("platform,status,account_name").eq("brand_id", id),
    ]);
    if (b.data) {
      const br = b.data as Brand;
      setBrand(br);
      setTone(br.tone_of_voice ?? "");
      setAudience(br.target_audience ?? "");
      setWebsite(br.website_url ?? "");
    }
    setMembers((m.data ?? []) as unknown as Member[]);
    setAssets((a.data ?? []) as Asset[]);
    setConns((c.data ?? []) as Conn[]);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function saveProfile() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase.from("brands").update({
      tone_of_voice: tone || null,
      target_audience: audience || null,
      website_url: website || null,
    }).eq("id", id);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "11px 13px", borderRadius: 10,
    background: "var(--surface-2)", border: "1px solid var(--border)",
    color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const cardStyle: React.CSSProperties = {
    padding: "24px 26px", borderRadius: 18,
    background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)",
  };

  if (!brand) {
    return (
      <PagePad>
        <div style={{ padding: 80, textAlign: "center" }}>
          <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "var(--text-5)", margin: "0 auto" }} />
        </div>
      </PagePad>
    );
  }

  return (
    <PagePad>
      <div className="flex flex-col gap-7 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
        {/* Header */}
        <div>
          <button onClick={() => router.push("/clients")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "var(--text-5)", fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 14 }}>
            <ArrowLeft style={{ width: 12, height: 12 }} /> All clients
          </button>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <h2 style={{ fontSize: "clamp(24px,4vw,30px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>{brand.name}</h2>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 12px", borderRadius: 20, color: "#34D399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)" }}>{brand.status}</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          {/* Brand profile (AERA reads this on every analysis) */}
          <div style={cardStyle}>
            <p className="section-label" style={{ display: "block", marginBottom: 6 }}>Brand Profile</p>
            <p style={{ fontSize: 11.5, color: "var(--text-6)", marginBottom: 18, lineHeight: 1.6 }}>
              AERA reads this on every analysis — the better this is, the sharper the recommendations.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Tone of voice</label>
                <input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="e.g. energetic, encouraging, no-nonsense" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Target audience</label>
                <input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="e.g. women 25-45 starting their fitness journey" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10.5, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Website</label>
                <input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" style={inputStyle} />
              </div>
              <button onClick={() => void saveProfile()} disabled={saving} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 18px", borderRadius: 10, background: "rgba(45,212,255,0.12)", border: "1px solid rgba(45,212,255,0.28)", color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer", marginTop: 2 }}>
                {saving ? <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} /> : saved ? <CheckCircle2 style={{ width: 13, height: 13 }} /> : null}
                {saved ? "Saved" : saving ? "Saving…" : "Save profile"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Team */}
            <div style={cardStyle}>
              <p className="section-label" style={{ display: "block", marginBottom: 14 }}>Team</p>
              {members.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-6)" }}>No members yet — invite them from Onboard.</p>
              ) : members.map((m) => (
                <div key={m.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
                  <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--text-4)" }}>
                    {(m.profiles?.full_name || m.profiles?.email || "?").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: "var(--text-2)" }}>{m.profiles?.full_name || m.profiles?.email}</p>
                    {m.profiles?.full_name && <p style={{ fontSize: 11, color: "var(--text-6)" }}>{m.profiles.email}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Connections */}
            <div style={cardStyle}>
              <p className="section-label" style={{ display: "block", marginBottom: 14 }}>Platform Connections</p>
              {conns.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--text-6)", lineHeight: 1.6 }}>
                  None connected yet. Per-brand platform connections activate with the publishing engine.
                </p>
              ) : conns.map((c) => (
                <div key={c.platform} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
                  <p style={{ fontSize: 13, color: "var(--text-2)", textTransform: "capitalize" }}>{c.platform.replace("_", " ")}</p>
                  <span style={{ fontSize: 10.5, color: c.status === "connected" ? "#34D399" : "var(--text-6)" }}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent content */}
        <div className="rounded-[18px] overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)" }}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="section-label">Recent Content</span>
            <button onClick={() => router.push("/content")} style={{ background: "none", border: "none", color: "var(--cyan)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Open Content →</button>
          </div>
          {assets.length === 0 ? (
            <p style={{ padding: 26, fontSize: 13, color: "var(--text-6)", textAlign: "center" }}>No content uploaded for this brand yet.</p>
          ) : assets.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 24px", borderBottom: i < assets.length - 1 ? "1px solid var(--border)" : "none" }}>
              <p style={{ flex: 1, fontSize: 13, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title ?? "Untitled"}</p>
              <span style={{ fontSize: 10.5, color: "var(--text-5)" }}>{a.type.replace("_", " ")}</span>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: "var(--cyan)", background: "rgba(45,212,255,0.07)", border: "1px solid rgba(45,212,255,0.16)" }}>{a.status}</span>
            </div>
          ))}
        </div>
      </div>
    </PagePad>
  );
}
