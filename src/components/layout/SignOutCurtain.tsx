"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/layout/SessionProvider";

/**
 * Sign-out curtain. Listens for the "apex:signout" event, fades the portal
 * to black with a short farewell, then actually signs out and returns to /login.
 */
export function SignOutCurtain() {
  const { data } = useSession();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const first = (data?.user?.name ?? "").split(" ")[0] || "";

  useEffect(() => {
    const handler = () => {
      setShow(true);
      // Hold the farewell on screen, then fade the whole curtain out before leaving.
      setTimeout(() => setLeaving(true), 3400);
      setTimeout(async () => {
        try { await createClient().auth.signOut(); } catch { /* ignore */ }
        window.location.href = "/login";
      }, 4200);
    };
    window.addEventListener("apex:signout", handler);
    return () => window.removeEventListener("apex:signout", handler);
  }, []);

  if (!show) return null;
  return (
    <div
      className={"auth-bg fixed inset-0 flex items-center justify-center " + (leaving ? "intro-out" : "")}
      style={{ zIndex: 9999, animation: leaving ? undefined : "intro-fade 0.6s ease both" }}
    >
      <div className="auth-orb" />
      <div className="relative text-center px-6">
        <p className="intro-fade text-[11px] tracking-[0.35em] uppercase mb-5" style={{ color: "#7fd9f7", animationDelay: "0.2s" }}>Signed out</p>
        <h1 className="intro-fade text-[32px] sm:text-[52px] font-extrabold tracking-tight leading-[1.05] mkt-gradient-text" style={{ animationDelay: "0.35s" }}>
          Until next time{first ? ", " + first : ""}.
        </h1>
        <p className="intro-fade mt-5 text-base sm:text-lg" style={{ color: "rgba(255,255,255,0.5)", animationDelay: "0.8s" }}>
          AERA keeps working while you are away.
        </p>
      </div>
    </div>
  );
}
