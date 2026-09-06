"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import { CheckCircle2, Loader2, AlertCircle, Mail, Link2, RefreshCw, User, Building2, Trash2, Clock } from "lucide-react";

type InviteRow = {
  id: string;
  email: string;
  status: string;
  role: string;
  accepted_at: string | null;
  created_at: string;
  brands: { name: string } | null;
};

export default function OnboardPage() {
  const [brandName, setBrandName] = useState("");
  const [email,     setEmail]     = useState("");
  const [tier,      setTier]      = useState<"client" | "enterprise">("client");
  const [orgName,   setOrgName]   = useState("");
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
      .select("id,email,status,role,accepted_at,created_at,brands(name)")
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
        body: JSON.stringify({ brandName, email, tier, orgName }),
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Something went wrong");
      setDone(`Invite sent to ${email}. Workspace "${brandName}" is ready. If the email does not land, use Copy link below.`);
      setBrandName("");
      setEmail("");
      setOrgName("");
      void loadInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  async function inviteAction(id: string, action: "link" | "resend" | "delete") {
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
      if (action === "delete") {
        setRowMsg(null);
        void loadInvites();
        return;
      }
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
          <p style={{ fontSize: 15, color: "var(--text-4)", marginTop: 12, lineHeight: 1.6, maxWidth: 480 }}>
            Create a client workspace and send the invite. They get an email link, set their name and password, and land inside their own portal, already connected to their brand.
          </p>
        </div>

        <form onSubmit={submit} className="mkt-card mkt-quiet" style={{ maxWidth: 520, display: "flex", flexDirection: "column", gap: 16, padding: "26px 28px", borderRadius: 18 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 8 }}>
              Account type
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {([
                { key: "client", icon: User, title: "Single client", body: "One brand, one workspace. Content, Queue, AERA." },
                { key: "enterprise", icon: Building2, title: "Enterprise", body: "An organization that runs several brands under one roof." },
              ] as const).map((opt) => {
                const on = tier === opt.key;
                return (
                  <button
                    type="button"
                    key={opt.key}
                    onClick={() => setTier(opt.key)}
                    style={{
                      textAlign: "left", padding: "14px 14px 13px", borderRadius: 12, cursor: "pointer",
                      background: on ? "rgba(45,212,255,0.08)" : "var(--surface-2)",
                      border: "1px solid " + (on ? "rgba(45,212,255,0.45)" : "var(--border)"),
                      boxShadow: on ? "var(--shadow-cyan)" : "none",
                      transition: "all 0.25s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <opt.icon style={{ width: 14, height: 14, color: on ? "var(--cyan)" : "var(--text-5)" }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: on ? "var(--text)" : "var(--text-3)" }}>{opt.title}</span>
                    </div>
                    <p style={{ fontSize: 11, lineHeight: 1.5, color: "var(--text-5)" }}>{opt.body}</p>
                  </button>
                );
              })}
            </div>
          </div>
          {tier === "enterprise" && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>
                Organization name
              </label>
              <input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="e.g. Chamber of Commerce" required style={inputStyle} />
            </div>
          )}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 7 }}>
              {tier === "enterprise" ? "First brand under this organization" : "Brand / Business name"}
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
              <AlertCircle style={{ width: 14, height: 14, color: "var(--rose)", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "var(--rose)" }}>{error}</p>
            </div>
          )}
          {done && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 9, background: "rgba(52,211,153,0.07)", border: "1px solid rgba(52,211,153,0.2)" }}>
              <CheckCircle2 style={{ width: 14, height: 14, color: "var(--green)", flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: "var(--green)" }}>{done}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="mkt-btn dash-btn"
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
        <div className="mkt-card mkt-quiet rounded-[18px] overflow-hidden" style={{ maxWidth: 720 }}>
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
                    {inv.brands?.name ?? "No brand"} · invited {new Date(inv.created_at).toLocaleDateString()}
                    {inv.accepted_at ? " · joined " + new Date(inv.accepted_at).toLocaleDateString() : ""}
                  </p>
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 20, color: "var(--text-5)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  {inv.role === "enterprise_admin" ? "Enterprise" : inv.role === "enterprise_member" ? "Seat" : "Client"}
                </span>
                {!inv.accepted_at && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => void inviteAction(inv.id, "link")} disabled={rowBusy !== ""} title="Copy a sign-in link" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {rowBusy === inv.id + "link" ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : <Link2 style={{ width: 11, height: 11 }} />}
                      Copy link
                    </button>
                    <button onClick={() => void inviteAction(inv.id, "resend")} disabled={rowBusy !== ""} title="Send the invite email again" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {rowBusy === inv.id + "resend" ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : <RefreshCw style={{ width: 11, height: 11 }} />}
                      Resend
                    </button>
                    <button onClick={() => { if (confirm("Delete this invite? If they never finished setup, their placeholder account is removed too.")) void inviteAction(inv.id, "delete"); }} disabled={rowBusy !== ""} title="Delete invite" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 9px", borderRadius: 8, background: "rgba(251,113,133,0.06)", border: "1px solid rgba(251,113,133,0.22)", color: "var(--rose)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      {rowBusy === inv.id + "delete" ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : <Trash2 style={{ width: 11, height: 11 }} />}
                    </button>
                  </div>
                )}
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                  padding: "4px 10px", borderRadius: 20,
                  color: inv.accepted_at ? "var(--green)" : "var(--amber)",
                  background: inv.accepted_at ? "rgba(52,211,153,0.08)" : "rgba(245,158,11,0.08)",
                  border: `1px solid ${inv.accepted_at ? "rgba(52,211,153,0.2)" : "rgba(245,158,11,0.2)"}`,
                }}>
                  {inv.accepted_at ? <CheckCircle2 style={{ width: 10, height: 10 }} /> : <Clock style={{ width: 10, height: 10 }} />}
                  {inv.accepted_at ? "Joined" : "Pending"}
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
