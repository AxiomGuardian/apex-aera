"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

type PendingPost = {
  id: string;
  platform: string;
  scheduled_at: string;
  status: string;
  content_assets: { title: string | null } | null;
  brands: { name: string } | null;
};
type ReadyAsset = {
  id: string;
  title: string | null;
  type: string;
  created_at: string;
  brands: { name: string } | null;
};

function fmtMST(iso: string) {
  return (
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Phoenix",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " MST"
  );
}

export default function ApprovalsPage() {
  const [posts,   setPosts]   = useState<PendingPost[]>([]);
  const [ready,   setReady]   = useState<ReadyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const [p, r] = await Promise.all([
      supabase.from("scheduled_posts")
        .select("id,platform,scheduled_at,status,content_assets(title),brands(name)")
        .in("status", ["proposed", "approved", "locked"])
        .order("scheduled_at"),
      supabase.from("content_assets")
        .select("id,title,type,created_at,brands(name)")
        .eq("status", "analyzed")
        .order("created_at", { ascending: false }),
    ]);
    setPosts((p.data ?? []) as unknown as PendingPost[]);
    setReady((r.data ?? []) as unknown as ReadyAsset[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function act(postId: string, status: "approved" | "cancelled") {
    setActing(postId);
    const supabase = createClient();
    await supabase.from("scheduled_posts").update({ status }).eq("id", postId);
    setActing(null);
    void load();
  }

  return (
    <PagePad>
      <div className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
        <div>
          <p className="label-eyebrow mb-2.5">Outbound Control</p>
          <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>
            Queue
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-4)", marginTop: 12, lineHeight: 1.6, maxWidth: 480 }}>
            Everything queued to go out, in one place. Autopilot schedules and publishes on its own — this is where you watch it happen and step in if you ever want to pause, pull, or reprioritize something before it fires.
          </p>
        </div>

        {/* Proposed posts */}
        <div className="mkt-card mkt-quiet rounded-[18px] overflow-hidden">
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="section-label">Queued to publish</span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center" }}><Loader2 className="animate-spin" style={{ width: 16, height: 16, color: "var(--text-5)", margin: "0 auto" }} /></div>
          ) : posts.length === 0 ? (
            <p style={{ padding: 26, fontSize: 13, color: "var(--text-6)", textAlign: "center" }}>
              Queue is empty. When the scheduling engine lines up posts, you'll see exactly what's going out, where, and when.
            </p>
          ) : posts.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 24px", borderBottom: i < posts.length - 1 ? "1px solid var(--border)" : "none" }}>
              <Clock style={{ width: 14, height: 14, color: "var(--amber)", flexShrink: 0 }} strokeWidth={1.6} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: "var(--text-2)" }}>{p.content_assets?.title ?? "Untitled"} → <span style={{ textTransform: "capitalize" }}>{p.platform.replace("_", " ")}</span></p>
                <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 3 }}>{p.brands?.name} · {fmtMST(p.scheduled_at)}</p>
              </div>
              <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", padding: "3px 9px", borderRadius: 20, color: p.status === "proposed" ? "var(--amber)" : "var(--green)", background: p.status === "proposed" ? "rgba(245,158,11,0.08)" : "rgba(52,211,153,0.08)", border: `1px solid ${p.status === "proposed" ? "rgba(245,158,11,0.2)" : "rgba(52,211,153,0.2)"}` }}>
                {p.status === "proposed" ? "Needs yes" : "Autopilot"}
              </span>
              {p.status === "proposed" && (
                <button onClick={() => void act(p.id, "approved")} disabled={acting === p.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 9, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.25)", color: "var(--green)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                  <CheckCircle2 style={{ width: 12, height: 12 }} /> Approve
                </button>
              )}
              <button onClick={() => void act(p.id, "cancelled")} disabled={acting === p.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 9, background: "transparent", border: "1px solid var(--border)", color: "var(--text-5)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                <XCircle style={{ width: 12, height: 12 }} /> Pull
              </button>
            </div>
          ))}
        </div>

        {/* Analyzed, ready to schedule */}
        <div className="mkt-card mkt-quiet rounded-[18px] overflow-hidden">
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="section-label">Analyzed, ready for scheduling</span>
          </div>
          {ready.length === 0 ? (
            <p style={{ padding: 26, fontSize: 13, color: "var(--text-6)", textAlign: "center" }}>
              No analyzed content waiting. Upload and analyze in Content and it appears here.
            </p>
          ) : ready.map((a, i) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 24px", borderBottom: i < ready.length - 1 ? "1px solid var(--border)" : "none" }}>
              <p style={{ flex: 1, fontSize: 13, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title ?? "Untitled"}</p>
              <span style={{ fontSize: 10.5, color: "var(--text-5)" }}>{a.brands?.name}</span>
              <span style={{ fontSize: 10.5, color: "var(--text-6)" }}>{a.type.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </PagePad>
  );
}
