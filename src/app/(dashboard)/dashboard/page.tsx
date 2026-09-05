"use client";

/**
 * Agency operator dashboard — answers one question:
 * "What's happening across my clients right now, and what needs me?"
 * All numbers are real Supabase queries. No placeholder metrics.
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Greeting } from "@/components/dashboard/Greeting";
import { PagePad } from "@/components/layout/PagePad";
import { ArrowUpRight, Users, Upload, Sparkles, Loader2 } from "lucide-react";

type BrandLite = { id: string; name: string; status: string; created_at: string };

const PIPELINE_STEPS = ["uploaded", "analyzing", "analyzed", "scheduled", "published"] as const;

export default function DashboardPage() {
  const router = useRouter();
  const [role,     setRole]     = useState<string | null>(null);
  const [brands,   setBrands]   = useState<BrandLite[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});
  const [pendingInvites, setPendingInvites] = useState(0);
  const [hbBusy, setHbBusy] = useState(false);
  const [hbMsg,  setHbMsg]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
      setRole(prof?.role ?? "client");
      if (prof?.role !== "agency_admin" && prof?.role !== "enterprise_admin") {
        router.replace("/content"); // single clients live in their workspace
        return;
      }
      const [b, a, inv] = await Promise.all([
        supabase.from("brands").select("id,name,status,created_at").order("created_at", { ascending: false }),
        supabase.from("content_assets").select("status"),
        supabase.from("invites").select("id", { count: "exact", head: true }).eq("status", "pending"),
      ]);
      setBrands((b.data ?? []) as BrandLite[]);
      const counts: Record<string, number> = {};
      for (const row of (a.data ?? []) as { status: string }[]) counts[row.status] = (counts[row.status] ?? 0) + 1;
      setPipeline(counts);
      setPendingInvites(inv.count ?? 0);
      setLoading(false);
    })();
  }, [router]);

  async function runHeartbeat() {
    setHbBusy(true);
    setHbMsg(null);
    try {
      const res = await fetch("/api/heartbeat", { method: "POST" });
      const j = (await res.json()) as { summary?: string; error?: string };
      setHbMsg(res.ok ? `Heartbeat: ${j.summary ?? "done"}` : (j.error ?? "Heartbeat failed"));
    } catch {
      setHbMsg("Heartbeat failed. Is the dev server running?");
    }
    setHbBusy(false);
  }

  const needsAttention: string[] = [];
  if ((pipeline.uploaded ?? 0) > 0) needsAttention.push(`${pipeline.uploaded} upload${pipeline.uploaded === 1 ? "" : "s"} waiting for AERA analysis`);
  if ((pipeline.analyzed ?? 0) > 0) needsAttention.push(`${pipeline.analyzed} analyzed asset${pipeline.analyzed === 1 ? "" : "s"} ready to schedule`);
  if (pendingInvites > 0) needsAttention.push(`${pendingInvites} client invite${pendingInvites === 1 ? "" : "s"} not yet accepted`);

  const card: React.CSSProperties = {
    borderRadius: 18, background: "var(--surface)",
    border: "1px solid var(--border)", boxShadow: "var(--shadow-card)",
  };

  if (loading || (role !== "agency_admin" && role !== "enterprise_admin")) {
    return (
      <PagePad>
        <div style={{ padding: 90, textAlign: "center" }}>
          <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "var(--text-5)", margin: "0 auto" }} />
        </div>
      </PagePad>
    );
  }

  return (
    <PagePad>
      <div className="flex flex-col gap-9 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>

        {/* Header + quick actions */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: "var(--cyan)" }}>
              {role === "agency_admin" ? "Agency Command" : "Enterprise Command"}
            </p>
            <Greeting />
            <p className="text-[14px] mt-3" style={{ color: "var(--text-5)" }}>
              {brands.length} client workspace{brands.length === 1 ? "" : "s"} · {Object.values(pipeline).reduce((s, n) => s + n, 0)} assets in the pipeline
            </p>
          </div>
          <div className="flex items-center gap-2.5 sm:shrink-0 flex-wrap">
            {[
              { label: "Onboard client", href: "/onboard", icon: Users },
              { label: "Upload content", href: "/content", icon: Upload },
              { label: "Ask AERA",       href: "/chat",    icon: Sparkles },
            ].map(({ label, href, icon: Icon }) => (
              <Link key={href} href={href}>
                <span className="mkt-btn dash-btn" style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.2)", color: "var(--cyan)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  <Icon style={{ width: 13, height: 13 }} strokeWidth={1.8} />
                  {label}
                </span>
              </Link>
            ))}
            <button
              onClick={() => void runHeartbeat()}
              disabled={hbBusy}
              className="dash-btn"
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 16px", borderRadius: 10, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)", color: "#34D399", fontSize: 12.5, fontWeight: 700, cursor: hbBusy ? "default" : "pointer" }}
            >
              {hbBusy ? "Heartbeat running…" : "Run heartbeat"}
            </button>
          </div>
        </div>
        {hbMsg && (
          <p style={{ fontSize: 12, color: "var(--text-5)", marginTop: -22 }}>{hbMsg}</p>
        )}

        {/* Pipeline */}
        <div className="mkt-card mkt-line-cyan" style={{ ...card, padding: "24px 28px" }}>
          <p className="section-label" style={{ display: "block", marginBottom: 18 }}>Content Pipeline</p>
          <div className="grid grid-cols-5 gap-2">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step} style={{ textAlign: "center", position: "relative" }}>
                <div className={(pipeline[step] ?? 0) > 0 ? "dash-num" : ""} style={{ fontSize: "clamp(22px,3vw,30px)", fontWeight: 800, letterSpacing: "-0.04em", color: (pipeline[step] ?? 0) > 0 ? "var(--text)" : "var(--text-6)" }}>
                  {pipeline[step] ?? 0}
                </div>
                <div style={{ fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-6)", marginTop: 6 }}>{step}</div>
                {i < PIPELINE_STEPS.length - 1 && (
                  <div style={{ position: "absolute", right: -6, top: 12, color: "var(--text-6)", fontSize: 12 }}>→</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-5 gap-5">
          {/* Clients */}
          <div className="md:col-span-3 mkt-card mkt-quiet" style={{ ...card, overflow: "hidden" }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="section-label">Clients</span>
              <Link href="/clients"><span style={{ fontSize: 12, color: "var(--cyan)", fontWeight: 600, cursor: "pointer" }}>View all <ArrowUpRight style={{ width: 11, height: 11, display: "inline" }} /></span></Link>
            </div>
            {brands.length === 0 ? (
              <p style={{ padding: 26, fontSize: 13, color: "var(--text-6)", textAlign: "center" }}>No clients yet. Onboard your first.</p>
            ) : brands.slice(0, 6).map((b, i) => (
              <div key={b.id} className="dash-row" onClick={() => router.push(`/clients/${b.id}`)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 24px", cursor: "pointer", borderBottom: i < Math.min(brands.length, 6) - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.status === "active" ? "#34D399" : "var(--text-6)" }} />
                <p style={{ flex: 1, fontSize: 13.5, color: "var(--text-2)" }}>{b.name}</p>
                <span style={{ fontSize: 11, color: "var(--text-6)" }}>{new Date(b.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>

          {/* Needs attention */}
          <div className="md:col-span-2 mkt-card mkt-quiet" style={{ ...card, overflow: "hidden" }}>
            <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <span className="section-label">Needs Attention</span>
            </div>
            {needsAttention.length === 0 ? (
              <p style={{ padding: 26, fontSize: 13, color: "var(--text-6)", textAlign: "center" }}>All clear. Nothing waiting on you.</p>
            ) : needsAttention.map((n, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 22px", borderBottom: i < needsAttention.length - 1 ? "1px solid var(--border)" : "none" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.5 }}>{n}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PagePad>
  );
}
