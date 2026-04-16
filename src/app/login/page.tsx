"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.ok) {
      router.push("/dashboard");
    } else {
      setError("Invalid email or password.");
    }
  }

  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(0,212,255,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="w-16 h-16 rounded-full mb-4 flex items-center justify-center"
            style={{
              background: "radial-gradient(circle, rgba(0,212,255,0.15) 0%, rgba(0,0,0,0.8) 100%)",
              border: "1px solid rgba(0,212,255,0.3)",
              boxShadow: "0 0 32px rgba(0,212,255,0.15)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4L28 10V22L16 28L4 22V10L16 4Z" stroke="rgba(0,212,255,0.9)" strokeWidth="1.5" fill="none" />
              <path d="M16 9L23 13V20L16 24L9 20V13L16 9Z" fill="rgba(0,212,255,0.2)" stroke="rgba(0,212,255,0.6)" strokeWidth="1" />
            </svg>
          </div>
          <h1
            className="text-2xl font-semibold tracking-widest uppercase"
            style={{ color: "rgba(0,212,255,0.9)" }}
          >
            APEX
          </h1>
          <p className="text-xs tracking-[0.3em] uppercase mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
            AERA Intelligence Platform
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(20px)",
          }}
        >
          <h2
            className="text-xl font-semibold mb-1 text-center"
            style={{ color: "rgba(255,255,255,0.9)" }}
          >
            Welcome back
          </h2>
          <p className="text-sm text-center mb-7" style={{ color: "rgba(255,255,255,0.4)" }}>
            Sign in to access your private dashboard
          </p>

          {/* Google */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.10)";
              e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            <span className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
              Continue with Google
            </span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
            <span className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.07)" }} />
          </div>

          {/* Email / Password form */}
          <form onSubmit={handleCredentials} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.85)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                color: "rgba(255,255,255,0.85)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)")}
              onBlur={(e)  => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)")}
            />

            {error && (
              <p className="text-xs text-center" style={{ color: "rgba(255,100,100,0.85)" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 mt-1"
              style={{
                background: loading ? "rgba(0,212,255,0.12)" : "rgba(0,212,255,0.16)",
                border: "1px solid rgba(0,212,255,0.30)",
                color: loading ? "rgba(0,212,255,0.5)" : "rgba(0,212,255,0.95)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.background = "rgba(0,212,255,0.22)";
              }}
              onMouseLeave={(e) => {
                if (!loading) e.currentTarget.style.background = "rgba(0,212,255,0.16)";
              }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="text-xs text-center mt-6" style={{ color: "rgba(255,255,255,0.2)" }}>
            Access is restricted to authorized APEX clients only.
          </p>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.15)" }}>
          © {new Date().getFullYear()} APEX. All rights reserved.
        </p>
      </div>
    </main>
  );
}
