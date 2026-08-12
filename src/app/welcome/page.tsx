"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function WelcomePage() {
  const router = useRouter();
  const [ready,     setReady]     = useState<"checking" | "ok" | "no-session">("checking");
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [password,  setPassword]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");

  useEffect(() => {
    const supabase = createClient();
    // The browser client exchanges the invite link code automatically on load.
    const t = setTimeout(() => {
      supabase.auth.getUser().then(({ data }) => setReady(data.user ? "ok" : "no-session"));
    }, 600);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const supabase = createClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { error: err } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName },
    });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (u.user) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", u.user.id);
    }
    router.push("/content");
    router.refresh();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "12px 16px", borderRadius: 12,
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.10)",
    color: "rgba(255,255,255,0.85)", fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(45,212,255,0.06) 0%, transparent 70%)" }} />
      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <svg viewBox="0 0 28 28" fill="none" width="34" height="34">
            <path d="M14 3L26 24H2L14 3Z" stroke="rgba(45,212,255,0.9)" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
            <path d="M8.5 18H19.5" stroke="rgba(45,212,255,0.9)" strokeWidth="1.4" strokeLinecap="round" />
            <circle cx="14" cy="3" r="1.4" fill="#2DD4FF" />
          </svg>
          <h1 className="text-xl font-semibold tracking-widest uppercase mt-3" style={{ color: "rgba(45,212,255,0.9)" }}>
            Welcome to APEX
          </h1>
          <p className="text-xs tracking-[0.25em] uppercase mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            Let&apos;s finish setting up your account
          </p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          {ready === "checking" && (
            <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>Verifying your invite…</p>
          )}
          {ready === "no-session" && (
            <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.5)" }}>
              This page works from your invite email. Open the link in the email we sent you — or ask your APEX contact to resend it.
            </p>
          )}
          {ready === "ok" && (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={inputStyle} />
                <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required style={inputStyle} />
              </div>
              <input type="password" placeholder="Choose a password (8+ characters)" value={password} minLength={8} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
              {error && <p className="text-xs text-center" style={{ color: "rgba(255,100,100,0.85)" }}>{error}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl text-sm font-semibold mt-1"
                style={{ background: "rgba(45,212,255,0.16)", border: "1px solid rgba(45,212,255,0.30)", color: "rgba(45,212,255,0.95)", cursor: saving ? "default" : "pointer" }}
              >
                {saving ? "Setting up…" : "Enter your workspace"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
