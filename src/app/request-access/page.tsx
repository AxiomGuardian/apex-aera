"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, Send } from "lucide-react";
import { MarketingNav, MarketingFooter, PageHeader } from "@/components/marketing/Shell";

/**
 * Request access. Submissions go straight to the APEX inbox via Web3Forms.
 * Set NEXT_PUBLIC_WEB3FORMS_KEY in Vercel to point at a dedicated Apex key.
 */
const ACCESS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "8166a420-1b2e-4051-8db7-217014c428e1";

export default function RequestAccessPage() {
  const [name, setName] = useState("");
  const [business, setBusiness] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [handle, setHandle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError("");
    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          access_key: ACCESS_KEY,
          subject: "New APEX AERA access request: " + business,
          from_name: "APEX AERA Website",
          name,
          business,
          email,
          phone,
          instagram_or_website: handle,
          message,
        }),
      });
      const j = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !j.success) throw new Error(j.message ?? "Could not send. Try again in a moment.");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
    color: "var(--text, #e8e8e8)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: "var(--text-5, #6e6e6e)", letterSpacing: "0.06em",
    textTransform: "uppercase", display: "block", marginBottom: 7,
  };

  return (
    <main className="min-h-screen" style={{ background: "var(--bg-deep, #0c0c0c)", color: "var(--text, #e8e8e8)" }}>
      <MarketingNav />
      <PageHeader
        kicker="Request access"
        title="Tell us about your brand."
        sub="APEX AERA is by invitation. Share a few details and we will reach out to walk you through it."
      />
      <section className="mx-auto max-w-2xl px-5 sm:px-6 pb-24 pt-2">
        {done ? (
          <div className="mkt-card mkt-line-cyan p-8 sm:p-10 text-center">
            <CheckCircle2 style={{ width: 30, height: 30, color: "#34D399", margin: "0 auto 14px" }} />
            <h2 className="font-semibold text-xl mb-2" style={{ color: "var(--text-2, #d8d8d8)" }}>Got it.</h2>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
              Your request is in. Someone from APEX will reach out to {email} soon.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mkt-card mkt-quiet p-6 sm:p-10 flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label style={label}>Your name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required style={input} />
              </div>
              <div>
                <label style={label}>Business or brand</label>
                <input value={business} onChange={(e) => setBusiness(e.target.value)} required style={input} />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label style={label}>Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={input} />
              </div>
              <div>
                <label style={label}>Phone (optional)</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={input} />
              </div>
            </div>
            <div>
              <label style={label}>Instagram or website</label>
              <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@yourbrand or yoursite.com" style={input} />
            </div>
            <div>
              <label style={label}>What are you hoping AERA handles for you?</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} style={{ ...input, resize: "vertical" }} />
            </div>
            <input type="checkbox" name="botcheck" tabIndex={-1} style={{ display: "none" }} aria-hidden />

            {error && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 12px", borderRadius: 9, background: "rgba(251,113,133,0.07)", border: "1px solid rgba(251,113,133,0.18)" }}>
                <AlertCircle style={{ width: 14, height: 14, color: "#fb7185", flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: "#fb7185" }}>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="mkt-btn inline-flex items-center justify-center gap-2 text-sm font-semibold px-7 py-3 rounded-full"
              style={{
                background: "linear-gradient(180deg, rgba(45,212,255,0.95), rgba(24,160,200,0.95))",
                color: "#04131a",
                boxShadow: "0 8px 32px rgba(45,212,255,0.25)",
                border: "none",
                cursor: sending ? "default" : "pointer",
              }}
            >
              {sending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : <Send style={{ width: 14, height: 14 }} />}
              {sending ? "Sending..." : "Request access"}
            </button>
            <p className="text-xs" style={{ color: "var(--text-6, #4e4e4e)" }}>
              We only use this to get back to you. See our Privacy Policy for the details.
            </p>
          </form>
        )}
      </section>
      <MarketingFooter />
    </main>
  );
}
