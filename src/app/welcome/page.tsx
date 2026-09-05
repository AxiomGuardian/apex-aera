"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function ApexMark() {
  return (
    <svg viewBox="0 0 28 28" fill="none" width="30" height="30" aria-hidden>
      <path d="M14 3L26 24H2L14 3Z" stroke="rgba(45,212,255,0.95)" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
      <path d="M8.5 18H19.5" stroke="rgba(45,212,255,0.95)" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="3" r="1.4" fill="#2DD4FF" />
    </svg>
  );
}

/** 0..4 strength score. 12+ chars is the floor. */
function scorePassword(p: string): number {
  let s = 0;
  if (p.length >= 12) s++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}
const STRENGTH_LABEL = ["", "Weak", "Fair", "Good", "Strong"];
const STRENGTH_COLOR = ["", "#fb7185", "#fbbf24", "#34d399", "#2dd4ff"];

export default function WelcomePage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");
  const [who, setWho] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const strength = scorePassword(password);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      // The invite link carries its own tokens. Always use THOSE, never a session
      // that already exists in this browser (e.g. an admin who is signed in).
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const code = new URLSearchParams(window.location.search).get("code");

      try {
        if (accessToken && refreshToken) {
          await supabase.auth.signOut({ scope: "local" });
          const { data, error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error || !data.user) throw error ?? new Error("no user");
          window.history.replaceState(null, "", window.location.pathname);
          setWho(data.user.email ?? "");
          setReady("ok");
          return;
        }
        if (code) {
          await supabase.auth.signOut({ scope: "local" });
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error || !data.user) throw error ?? new Error("no user");
          window.history.replaceState(null, "", window.location.pathname);
          setWho(data.user.email ?? "");
          setReady("ok");
          return;
        }
        setReady("no-session");
      } catch {
        setReady("no-session");
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (strength < 3) {
      setError("Mix upper and lower case letters with numbers or symbols.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const { error: err } = await supabase.auth.updateUser({ password, data: { full_name: fullName } });
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    let dest = "/content";
    if (u.user) {
      await supabase.from("profiles").update({ full_name: fullName }).eq("id", u.user.id);
      const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
      if (prof?.role === "agency_admin") dest = "/dashboard";
    }
    router.push(dest);
    router.refresh();
  }

  return (
    <main className="auth-bg mkt-grid min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="auth-orb" />

      <div className="relative w-full max-w-[440px]">
        <div className="mkt-reveal flex flex-col items-center mb-8">
          <div className="auth-mark">
            <ApexMark />
          </div>
          <h1 className="text-lg font-semibold tracking-[0.32em] uppercase mt-5" style={{ color: "#ececec" }}>
            Welcome to APEX
          </h1>
          <p className="text-[10.5px] tracking-[0.3em] uppercase mt-1.5" style={{ color: "rgba(255,255,255,0.32)" }}>
            Let&apos;s finish setting up your account
          </p>
        </div>

        <div className="mkt-card mkt-line-cyan auth-card mkt-reveal p-8 sm:p-9" style={{ animationDelay: "0.1s" }}>
          {ready === "checking" && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} /> Verifying your invite
            </div>
          )}

          {ready === "no-session" && (
            <div className="text-center py-2">
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                This page opens from your invite email. Tap the button in the email we sent you, or ask your APEX contact to resend it.
              </p>
              <Link href="/login" className="mkt-btn auth-primary inline-flex items-center justify-center gap-2 mt-6" style={{ width: "auto", padding: "12px 22px" }}>
                Already set up? Sign in <ArrowRight style={{ width: 14, height: 14 }} />
              </Link>
            </div>
          )}

          {ready === "ok" && (
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div className="text-center mb-3">
                <h2 className="text-[22px] font-extrabold tracking-tight mkt-gradient-text">Your workspace is ready.</h2>
                {who && (
                  <p className="text-xs mt-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Setting up <span style={{ color: "#9be7ff" }}>{who}</span>
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" required className="auth-input" />
                <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" required className="auth-input" />
              </div>

              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  placeholder="Create a password (12+ characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  className="auth-input"
                  style={{ paddingRight: 46 }}
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md"
                  style={{ color: "rgba(255,255,255,0.4)", background: "transparent" }}
                >
                  {show ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                </button>
              </div>

              <div>
                <div className="auth-strength">
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} style={{ background: strength >= i ? STRENGTH_COLOR[strength] : undefined }} />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                    12+ characters with upper and lower case, a number, and a symbol.
                  </p>
                  {password && (
                    <p className="text-[11px] font-semibold" style={{ color: STRENGTH_COLOR[strength] || "rgba(255,255,255,0.35)" }}>
                      {STRENGTH_LABEL[strength]}
                    </p>
                  )}
                </div>
              </div>

              {error && (
                <p className="text-xs text-center rounded-lg px-3 py-2" style={{ color: "#fda4af", background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)" }}>
                  {error}
                </p>
              )}

              <button type="submit" disabled={saving} className="mkt-btn auth-primary mt-2 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} /> : null}
                {saving ? "Setting up" : "Enter your workspace"}
                {!saving && <ArrowRight style={{ width: 15, height: 15 }} />}
              </button>
            </form>
          )}
        </div>

        <p className="mkt-reveal text-center text-[11px] mt-7" style={{ color: "rgba(255,255,255,0.18)", animationDelay: "0.2s" }}>
          © {new Date().getFullYear()} APEX AERA · <Link href="/privacy" className="auth-ghost">Privacy</Link> · <Link href="/terms" className="auth-ghost">Terms</Link>
        </p>
      </div>
    </main>
  );
}
