"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/layout/SessionProvider";

/**
 * Sign-out curtain. Listens for "apex:signout", drops a solid veil over the
 * portal, shows a short farewell, signs out underneath it, then moves to /login.
 * The veil never becomes transparent, so nothing behind it ever shows.
 */
export function SignOutCurtain() {
  const { data } = useSession();
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [first, setFirst] = useState("");

  useEffect(() => {
    const handler = () => {
      // Capture the name now; the session is about to go away
      setFirst((data?.user?.name ?? "").split(" ")[0] || "");
      setShow(true);
      setTimeout(async () => {
        setLeaving(true); // words fade, veil stays
        try { await createClient().auth.signOut(); } catch { /* ignore */ }
      }, 3400);
      setTimeout(() => { window.location.href = "/login"; }, 4300);
    };
    window.addEventListener("apex:signout", handler);
    return () => window.removeEventListener("apex:signout", handler);
  }, [data]);

  if (!show) return null;
  return (
    <div className="auth-bg intro-veil fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="auth-orb" />
      <div className={"relative text-center px-6 " + (leaving ? "intro-out" : "")}>
        <p className="intro-fade text-[11px] tracking-[0.35em] uppercase mb-5" style={{ color: "#7fd9f7", animationDelay: "0.3s" }}>Signed out</p>
        <h1 className="intro-fade text-[32px] sm:text-[52px] font-extrabold tracking-tight leading-[1.05] mkt-gradient-text" style={{ animationDelay: "0.5s" }}>
          Until next time{first ? ", " + first : ""}.
        </h1>
        <p className="intro-fade mt-5 text-base sm:text-lg" style={{ color: "rgba(255,255,255,0.5)", animationDelay: "1.0s" }}>
          AERA keeps working while you are away.
        </p>
      </div>
    </div>
  );
}
