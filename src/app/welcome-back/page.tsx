"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/layout/SessionProvider";
import { homeFor } from "@/lib/roles";

/**
 * Welcome back. One beat, real numbers, then into the portal.
 * "Since you were here" is computed from the previous last_seen_at stamp.
 */

type Recap = { published: number; scheduled: number; analyzed: number; sinceLabel: string | null };

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3600000);
  if (h < 1) return "a few minutes";
  if (h < 24) return h + (h === 1 ? " hour" : " hours");
  const d = Math.floor(h / 24);
  return d + (d === 1 ? " day" : " days");
}

export default function WelcomeBackPage() {
  const router = useRouter();
  const { data, status } = useSession();
  const [recap, setRecap] = useState<Recap | null>(null);
  const [leaving, setLeaving] = useState(false);

  const role = data?.user?.role ?? null;
  const first = (data?.user?.name ?? "").split(" ")[0] || "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetch("/api/auth/touch", { method: "POST" }).then((x) => x.json()).catch(() => ({ since: null }));
      const since: string | null = r?.since ?? null;
      const supabase = createClient();
      const sinceIso = since ?? new Date(Date.now() - 7 * 86400000).toISOString();
      const [pub, sch, ana] = await Promise.all([
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("status", "published").gte("published_at", sinceIso),
        supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).in("status", ["approved", "locked", "proposed"]).gte("scheduled_at", new Date().toISOString()),
        supabase.from("analyses").select("id", { count: "exact", head: true }).gte("created_at", sinceIso),
      ]);
      if (cancelled) return;
      setRecap({
        published: pub.count ?? 0,
        scheduled: sch.count ?? 0,
        analyzed: ana.count ?? 0,
        sinceLabel: since ? ago(since) : null,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  function enter() {
    setLeaving(true);
    setTimeout(() => router.replace(homeFor(role)), 600);
  }

  // Auto-advance a few seconds after the recap is on screen
  useEffect(() => {
    if (!recap) return;
    const t = setTimeout(enter, 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recap]);

  if (status === "unauthenticated") { router.replace("/login"); return null; }

  const lines: string[] = [];
  if (recap) {
    if (recap.published > 0) lines.push(recap.published + (recap.published === 1 ? " post went live" : " posts went live"));
    if (recap.analyzed > 0) lines.push(recap.analyzed + (recap.analyzed === 1 ? " upload analyzed" : " uploads analyzed"));
    if (recap.scheduled > 0) lines.push(recap.scheduled + (recap.scheduled === 1 ? " post waiting in the queue" : " posts waiting in the queue"));
  }

  return (
    <main
      className={"auth-bg min-h-screen flex items-center justify-center px-5 relative overflow-hidden " + (leaving ? "intro-out" : "")}
      onClick={enter}
      style={{ cursor: "pointer" }}
    >
      <div className="auth-orb" />
      <div className="relative text-center max-w-2xl">
        <p className="intro-fade text-[11px] tracking-[0.35em] uppercase mb-5" style={{ color: "#7fd9f7" }}>
          {recap?.sinceLabel ? "Gone " + recap.sinceLabel : "APEX AERA"}
        </p>
        <h1 className="intro-fade text-[34px] sm:text-[56px] font-extrabold tracking-tight leading-[1.05] mkt-gradient-text" style={{ animationDelay: "0.15s" }}>
          Welcome back{first ? ", " + first : ""}.
        </h1>

        {recap && (
          <div className="intro-fade mt-8" style={{ animationDelay: "0.5s" }}>
            {lines.length > 0 ? (
              <>
                <p className="text-[11px] tracking-[0.3em] uppercase mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>Since you were here</p>
                <div className="flex flex-col items-center gap-2">
                  {lines.map((l, i) => (
                    <p key={l} className="intro-fade text-lg sm:text-xl font-semibold" style={{ color: "#e6e6e6", animationDelay: (0.7 + i * 0.18).toFixed(2) + "s" }}>{l}</p>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-lg" style={{ color: "rgba(255,255,255,0.5)" }}>AERA kept watch. Nothing needed you.</p>
            )}
          </div>
        )}

        <div className="intro-fade mt-10" style={{ animationDelay: "1.2s" }}>
          <button onClick={(e) => { e.stopPropagation(); enter(); }} className="mkt-btn auth-primary inline-flex items-center justify-center gap-2" style={{ width: "auto", padding: "13px 28px", borderRadius: 999 }}>
            Continue <ArrowRight style={{ width: 15, height: 15 }} />
          </button>
        </div>
      </div>
    </main>
  );
}
