"use client";

import { signOut } from "next-auth/react";

export default function AccessDeniedPage() {
  return (
    <main className="min-h-screen bg-black flex items-center justify-center px-4">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 40% at 50% 50%, rgba(255,60,60,0.04) 0%, transparent 70%)",
        }}
      />
      <div className="relative text-center max-w-sm">
        <div
          className="w-16 h-16 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{
            background: "rgba(255,60,60,0.08)",
            border: "1px solid rgba(255,60,60,0.2)",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 19h20L12 2z" stroke="rgba(255,100,100,0.8)" strokeWidth="1.5" fill="none"/>
            <path d="M12 9v5M12 16.5v.5" stroke="rgba(255,100,100,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
        <h1
          className="text-xl font-semibold mb-2"
          style={{ color: "rgba(255,255,255,0.9)", fontFamily: "var(--font-display)" }}
        >
          Access Restricted
        </h1>
        <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
          Your account hasn&apos;t been granted access to the APEX AERA dashboard.
          Please contact your APEX representative.
        </p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm px-6 py-2 rounded-lg transition-all duration-200"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          Sign out
        </button>
      </div>
    </main>
  );
}
