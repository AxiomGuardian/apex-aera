"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Fingerprint, CheckCircle2, Wand2, LayoutDashboard, Users, Plus, ArrowRight } from "lucide-react";
import { useSession } from "@/components/layout/SessionProvider";
import { navFor, homeFor, type NavKey } from "@/lib/roles";

/**
 * First-run intro. Black, cinematic, three beats:
 *  1. APEX AERA resolves out of the dark
 *  2. Welcome, name. This is your workspace.
 *  3. A tour of the tabs this person actually has
 */

const ICONS: Record<NavKey, typeof Upload> = {
  dashboard: LayoutDashboard, clients: Users, onboard: Plus,
  content: Upload, brand: Fingerprint, queue: CheckCircle2, aera: Wand2,
};
const BLURB: Record<NavKey, string> = {
  dashboard: "Everything across your brands in one glance: pipeline, clients, and what needs you.",
  clients:   "Every workspace you run. Open one to tune its voice, connections, and intelligence.",
  onboard:   "Bring a new client in. One form, one email, and their workspace is live.",
  content:   "Drop in videos and images. AERA watches, writes, and schedules from here.",
  brand:     "Your voice, your audience, your connected accounts. AERA reads this before every post.",
  queue:     "What is going out and when, in your timezone. Pull anything before it publishes.",
  aera:      "Your brand companion. Ask questions, brainstorm, and steer the strategy.",
};

export default function IntroPage() {
  const router = useRouter();
  const { data, status } = useSession();
  const [beat, setBeat] = useState<0 | 1 | 2>(0);
  const [leaving, setLeaving] = useState(false);

  const role = data?.user?.role ?? null;
  const first = (data?.user?.name ?? "").split(" ")[0] || "there";
  const tabs = navFor(role);

  useEffect(() => {
    const t1 = setTimeout(() => setBeat(1), 3200);
    const t2 = setTimeout(() => setBeat(2), 6200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function enter() {
    try { localStorage.setItem("apex-intro-seen", "1"); } catch { /* ignore */ }
    setLeaving(true);
    setTimeout(() => router.replace(homeFor(role)), 650);
  }

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <main
      className={"auth-bg min-h-screen flex items-center justify-center px-5 relative overflow-hidden " + (leaving ? "intro-out" : "")}
      onClick={() => beat < 2 && setBeat((b) => (b + 1) as 0 | 1 | 2)}
      style={{ cursor: beat < 2 ? "pointer" : "default" }}
    >
      <div className="auth-orb" />

      {beat === 0 && (
        <div className="relative text-center">
          <h1 className="intro-title text-[34px] sm:text-[64px]">APEX AERA</h1>
          <div className="intro-line" />
        </div>
      )}

      {beat === 1 && (
        <div className="relative text-center intro-fade max-w-xl">
          <p className="text-[11px] tracking-[0.35em] uppercase mb-5" style={{ color: "#7fd9f7" }}>Welcome, {first}</p>
          <h2 className="text-[30px] sm:text-[48px] font-extrabold tracking-tight leading-[1.05] mkt-gradient-text">
            This is your workspace.
          </h2>
          <p className="mt-5 text-base sm:text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>
            AERA is already awake. Here is how to move around.
          </p>
        </div>
      )}

      {beat === 2 && (
        <div className="relative w-full max-w-5xl intro-fade">
          <div className="text-center mb-10">
            <p className="text-[11px] tracking-[0.35em] uppercase mb-3" style={{ color: "#7fd9f7" }}>Your tabs</p>
            <h2 className="text-[26px] sm:text-[38px] font-extrabold tracking-tight" style={{ color: "#f0f0f0" }}>
              {["", "One place", "Two places", "Three places", "Four places", "Five places", "Six places", "Seven places"][tabs.length] ?? "A few places"}. That is the whole portal.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tabs.map((t, i) => {
              const Icon = ICONS[t.key];
              return (
                <div
                  key={t.key}
                  className="mkt-card mkt-line-cyan intro-fade p-6"
                  style={{ animationDelay: (0.15 + i * 0.12).toFixed(2) + "s" }}
                >
                  <div className="dash-chip mb-4">
                    <Icon style={{ width: 18, height: 18, color: "#2dd4ff" }} />
                  </div>
                  <h3 className="font-semibold mb-2" style={{ color: "#e4e4e4" }}>{t.label}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>{BLURB[t.key]}</p>
                </div>
              );
            })}
          </div>
          <div className="text-center mt-10 intro-fade" style={{ animationDelay: "0.8s" }}>
            <button onClick={enter} className="mkt-btn auth-primary inline-flex items-center justify-center gap-2" style={{ width: "auto", padding: "14px 30px", borderRadius: 999 }}>
              Enter your workspace <ArrowRight style={{ width: 15, height: 15 }} />
            </button>
          </div>
        </div>
      )}

      {beat < 2 && (
        <p className="absolute bottom-8 left-0 right-0 text-center text-[11px] tracking-[0.2em] uppercase" style={{ color: "rgba(255,255,255,0.22)" }}>
          Click to continue
        </p>
      )}
    </main>
  );
}
