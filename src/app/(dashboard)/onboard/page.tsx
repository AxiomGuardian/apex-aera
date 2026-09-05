"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import { CheckCircle2, Loader2, AlertCircle, Mail, Link2, RefreshCw } from "lucide-react";

type InviteRow = {
  id: string;
  email: string;
  status: string;
  created_at: string;
  brands: { name: string } | null;
};

export default function OnboardPage() {
  const [brandName, setBrandName] = useState("");
  const [email,     setEmail]     = useState("");
  const [sending,   setSending]   = useState(false);
  const [done,      setDone]      = useState<string | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const [invites,   setInvites]   = useState<InviteRow[]>([]);
  const [rowBusy,   setRowBusy]   = useState<string>("");
  const [rowMsg,    setRowMsg]    = useState<{ id: string; text: string } | null>(null);

  const loadInvites = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("invites")
      .select("id,email,status,created_at,brands(name)")
      .order("created_at", { ascending: false })
      .limit(20);
    setInvites((data ?? []) as unknown as InviteRow[]);
  }, []);

  useEffect(() => { void loadInvites(); }, [loadInvites]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    setDone(null);
    try {
      const res = await fetch("/api/agency/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName, email }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Something went wrong");
      setDone(`Invite sent to ${email}. Workspace "${brandName}" is ready. If the email does not land, use Copy link below.`);
      setBrandName("");
      setEmail("");
      void loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function inviteAction(id: string, action: "link" | "resend") {
    setRowBusy(id + action);
    setRowMsg(null);
    try {
      const res = await fetch("/api/agency/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId: id, action }),
      });
      const j = (await res.json()) as { ok?: boolean; link?: string; via?: string; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Failed");
      if (action === "link" && j.link) {
        try { await navigator.clipboard.writeText(j.link); setRowMsg({ id, text: "Link copied. Send it however you like." }); }
        catch { setRowMsg({ id, text: j.link }); }
      } else {
        setRowMsg({ id, text: j.via === "resend" ? "Sent from APEX." : "Sent via the built-in mailer." });
      }
    } catch (err) {
      setRowMsg({ id, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setRowBusy("");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: "var(--surface-2)", border: "1px solid var(--border)",
    color: "var(--text)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <PagePad>
      <div className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>
        <div>
          <p className="label-eyebrow mb-2.5">Client Onboarding</p>
          <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>
            Onboard
          </h2>
          <p style={{ fontSize: 14, color: "var(--text-5)", marginTop: 12, lineHeight: 1.6, maxWidth: 480 }}>
            Create a client workspace and send the invite. They get an email link, set their name and password, and land inside their own portal — already connected to their brand.
          </p>
        </div>

        <form onSubmit={submit} style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 16, padding: "26px 28px", borderRadius: 18, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "var(--shadow-card)" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>
              Brand / Business name
            </label>
            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="Brand or business name" required style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>
              Client email
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@business.com" required style={inputStyle} />
          </div>

          {error && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 9, background: "rgba(251,113,133,0.07)", border: "1px solid rgba(251,113,133,0.18)" }}>
              <AlertCircle style={{ width: 14, height: 14, color: "#fb7185", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#fb7185" }}>{error}</p>
            </div>
          )}
          {done && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 9, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: "#34D399", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "#34D399" }}>{done}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "13px 20px", borderRadius: 11,
              background: sending ? "rgba(45,212,255,0.10)" : "rgba(45,212,255,0.14)",
              border: "1px solid rgba(45,212,255,0.30)",
              color: "var(--cyan)", fontSize: 14, fontWeight: 700,
              cursor: sending ? "default" : "pointer",
            }}
          >
            {sending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : <Mail style={{ width: 14, height: 14 }} strokeWidth={1.8} />}
            {sending ? "Creating workspace…" : "Create workspace & send invite"}
          </button>
        </form>

        {/* Invite history */}
        <div className="rounded-[18px] overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)", maxWidth: 720 }}>
          <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="section-label">Invites</span>
          </div>
          {invites.length === 0 ? (
            <p style={{ padding: "26px", fontSize: 13, color: "var(--text-6)", textAlign: "center" }}>No invites sent yet.</p>
          ) : (
            invites.map((inv, i) => (
              <div key={inv.id} style={{ borderBottom: i < invites.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 24px" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, color: "var(--text-2)" }}>{inv.email}</p>
                  <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 3 }}>
                    {inv.brands?.name ?? "—"} · {new Date(inv.created_at).toLocaleDateString()}
                  </p>
                </div>
                {inv.status !== "claimed" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => void inviteAction(inv.id, "link")} disabled={rowBusy !== ""} title="Copy a sign-in link" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {rowBusy === inv.id + "link" ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : <Link2 style={{ width: 11, height: 11 }} />}
                      Copy link
                    </button>
                    <button onClick={() => void inviteAction(inv.id, "resend")} disabled={rowBusy !== ""} title="Send the invite email again" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {rowBusy === inv.id + "resend" ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : <RefreshCw style={{ width: 11, height: 11 }} />}
                      Resend
                    </button>
                  </div>
                )}
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  padding: "4px 10px", borderRadius: 20,
                  color: inv.status === "claimed" ? "#34D399" : "#F59E0B",
                  background: inv.status === "claimed" ? "rgba(52,211,153,0.08)" : "rgba(245,158,11,0.08)",
                  border: `1px solid ${inv.status === "claimed" ? "rgba(52,211,153,0.2)" : "rgba(245,158,11,0.2)"}`,
                }}>
                  {inv.status === "claimed" ? "Joined" : "Pending"}
                </span>
              </div>
              {rowMsg?.id === inv.id && (
                <p style={{ padding: "0 24px 12px", fontSize: 11.5, color: "var(--cyan)", wordBreak: "break-all" }}>{rowMsg.text}</p>
              )}
              </div>
            ))
          )}
        </div>
      </div>
    </PagePad>
  );
}
