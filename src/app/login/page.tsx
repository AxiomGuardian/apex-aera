"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function ApexMark() {
  return (
    <svg viewBox="0 0 28 28" fill="none" width="30" height="30" aria-hidden>
      <path d="M14 3L26 24H2L14 3Z" stroke="rgba(45,212,255,0.95)" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
      <path d="M8.5 18H19.5" stroke="rgba(45,212,255,0.95)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14 10L18.5 18" stroke="rgba(45,212,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M14 10L9.5 18" stroke="rgba(45,212,255,0.5)" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="14" cy="3" r="1.4" fill="#2DD4FF" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err || !data.user) {
      setLoading(false);
      setError("That email and password did not match.");
      return;
    }
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
    router.push(prof?.role === "agency_admin" ? "/dashboard" : "/content");
    router.refresh();
  }

  return (
    <main className="auth-bg mkt-grid min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
      <div className="auth-orb" />

      <div className="relative w-full max-w-[420px]">
        {/* Mark */}
        <div className="mkt-reveal flex flex-col items-center mb-8">
          <div className="auth-mark">
            <ApexMark />
          </div>
          <h1 className="text-lg font-semibold tracking-[0.32em] uppercase mt-5" style={{ color: "#ececec" }}>
            APEX
          </h1>
          <p className="text-[10.5px] tracking-[0.3em] uppercase mt-1.5" style={{ color: "rgba(255,255,255,0.32)" }}>
            AERA Intelligence Platform
          </p>
        </div>

        {/* Card */}
        <div className="mkt-card mkt-line-cyan auth-card mkt-reveal p-8 sm:p-9" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-[22px] font-extrabold tracking-tight text-center mkt-gradient-text">
            Welcome back
          </h2>
          <p className="text-sm text-center mt-1.5 mb-7" style={{ color: "rgba(255,255,255,0.42)" }}>
            Sign in to your private workspace.
          </p>

          <form onSubmit={handleCredentials} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="auth-input"
            />
            <div className="relative">
              <input
                type={show ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="auth-input"
                style={{ paddingRight: 46 }}
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors"
                style={{ color: "rgba(255,255,255,0.4)", background: "transparent" }}
              >
                {show ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </div>

            {error && (
              <p className="text-xs text-center rounded-lg px-3 py-2" style={{ color: "#fda4af", background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.2)" }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="mkt-btn auth-primary mt-2 flex items-center justify-center gap-2">
              {loading ? <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} /> : null}
              {loading ? "Signing in" : "Enter the portal"}
              {!loading && <ArrowRight style={{ width: 15, height: 15 }} />}
            </button>
          </form>

          <div className="flex items-center justify-between mt-7">
            <Link href="/request-access" className="auth-ghost">Not a client yet? Request access</Link>
            <Link href="/" className="auth-ghost">apexaera.com</Link>
          </div>
        </div>

        <p className="mkt-reveal text-center text-[11px] mt-7" style={{ color: "rgba(255,255,255,0.18)", animationDelay: "0.2s" }}>
          © {new Date().getFullYear()} APEX AERA · <Link href="/privacy" className="auth-ghost">Privacy</Link> · <Link href="/terms" className="auth-ghost">Terms</Link>
        </p>
      </div>
    </main>
  );
}
