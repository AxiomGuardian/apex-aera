import Link from "next/link";
import { ArrowRight, Command, Building2, Layers, Radar, ScanEye, PenLine, Monitor, Smartphone } from "lucide-react";
import { MarketingNav, MarketingFooter, CtaBand } from "@/components/marketing/Shell";

/**
 * APEX AERA public front page. Premium dark, cyan accent, line-trace effects.
 * No fabricated stats, logos, or testimonials.
 */

const DOORS = [
  {
    icon: Command,
    accent: "mkt-line-cyan",
    iconColor: "#2dd4ff",
    iconBg: "rgba(45,212,255,0.08)",
    title: "Agency Command",
    body: "The master view. Every client, every queue, every engine in one place, with full control of the whole operation from a single screen.",
  },
  {
    icon: Building2,
    accent: "mkt-line-green",
    iconColor: "#34d399",
    iconBg: "rgba(52,211,153,0.08)",
    title: "Brand Workspaces",
    body: "A private portal for each client. Their content, their calendar, their reports, their conversations with AERA. Nothing from anyone else.",
  },
  {
    icon: Layers,
    accent: "mkt-line-amber",
    iconColor: "#fbbf24",
    iconBg: "rgba(251,191,36,0.08)",
    title: "Enterprise",
    body: "Built for organizations that carry many brands under one roof, with roles for every seat and qualification gates at every door.",
  },
];

const ENGINE_PREVIEW = [
  {
    icon: Radar,
    title: "Trend Research",
    body: "AERA scans the live web and X for what is moving in your niche right now, then writes with that knowledge in hand.",
  },
  {
    icon: ScanEye,
    title: "Content Intelligence",
    body: "Upload a video and AERA watches it. Frames, audio, transcript. It understands what your content is actually about.",
  },
  {
    icon: PenLine,
    title: "Caption Studio",
    body: "A distinct angle for every platform. Instagram is not TikTok is not LinkedIn, and AERA writes like it knows the difference.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-deep, #0c0c0c)", color: "var(--text, #e8e8e8)" }}>
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden mkt-grid">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(45,212,255,0.10) 0%, transparent 65%)" }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 40% 30% at 85% 70%, rgba(45,212,255,0.05) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-24 sm:pt-32 sm:pb-28 text-center">
          <p
            className="mkt-reveal inline-block text-[11px] tracking-[0.28em] uppercase mb-6 px-4 py-1.5 rounded-full"
            style={{ color: "#7fd9f7", border: "1px solid rgba(45,212,255,0.25)", background: "rgba(45,212,255,0.06)" }}
          >
            Agentic AI Marketing
          </p>
          <h1
            className="mkt-reveal font-extrabold leading-[1.05] tracking-tight text-4xl sm:text-6xl"
            style={{ color: "var(--text, #ececec)", animationDelay: "0.08s" }}
          >
            Your marketing,
            <br />
            <span className="mkt-gradient-text">running itself.</span>
          </h1>
          <p
            className="mkt-reveal mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed"
            style={{ color: "var(--text-4, #9a9a9a)", animationDelay: "0.16s" }}
          >
            APEX AERA studies your brand, researches your market in real time, writes platform
            native content, schedules it, publishes it, and reports on it. It works around the
            clock so you can run your business.
          </p>
          <div className="mkt-reveal mt-10 flex items-center justify-center gap-4 flex-wrap" style={{ animationDelay: "0.24s" }}>
            <Link
              href="/login"
              className="mkt-btn text-sm font-semibold px-7 py-3 rounded-full"
              style={{
                background: "linear-gradient(180deg, rgba(45,212,255,0.95), rgba(24,160,200,0.95))",
                color: "#04131a",
                boxShadow: "0 8px 32px rgba(45,212,255,0.25)",
              }}
            >
              Enter the portal
            </Link>
            <Link
              href="/how-it-works"
              className="mkt-btn text-sm font-medium px-7 py-3 rounded-full"
              style={{ border: "1px solid rgba(255,255,255,0.14)", color: "var(--text-3, #bebebe)" }}
            >
              See how it works
            </Link>
          </div>
          <p className="mkt-reveal mt-8 text-xs tracking-wide" style={{ color: "var(--text-5, #6e6e6e)", animationDelay: "0.32s" }}>
            Access is by invitation. Every client workspace is private and qualified.
          </p>
        </div>
      </section>

      {/* Three doors */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
            One platform. Three doors.
          </h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--text-4, #9a9a9a)" }}>
            Everyone signs in through the same portal. What you see on the other side depends on who you are.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {DOORS.map((d) => (
            <div key={d.title} className={"mkt-card " + d.accent + " p-7"}>
              <div
                className="w-11 h-11 rounded-xl mb-5 flex items-center justify-center"
                style={{ background: d.iconBg, border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <d.icon style={{ width: 18, height: 18, color: d.iconColor }} />
              </div>
              <h3 className="font-semibold text-lg mb-2.5" style={{ color: "var(--text-2, #d8d8d8)" }}>
                {d.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                {d.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Web portal + mobile app */}
      <section className="relative mkt-grid">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 55% 60% at 50% 100%, rgba(45,212,255,0.05) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mb-12 text-center">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
              On your desk. In your pocket.
            </h2>
            <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--text-4, #9a9a9a)" }}>
              AERA never sleeps, so your access should never be out of reach.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="mkt-card mkt-line-cyan p-8">
              <div
                className="w-11 h-11 rounded-xl mb-5 flex items-center justify-center"
                style={{ background: "rgba(45,212,255,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Monitor style={{ width: 18, height: 18, color: "#2dd4ff" }} />
              </div>
              <h3 className="font-semibold text-lg mb-2.5" style={{ color: "var(--text-2, #d8d8d8)" }}>
                The Web Portal
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                The full command center, live today. Upload content, watch AERA analyze it, review
                the queue, read your trend briefs and reports, and talk to AERA directly. Everything
                happens right here on this domain, one sign in away.
              </p>
            </div>
            <div className="mkt-card mkt-line-violet p-8">
              <div
                className="w-11 h-11 rounded-xl mb-5 flex items-center justify-center"
                style={{ background: "rgba(167,139,250,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Smartphone style={{ width: 18, height: 18, color: "#a78bfa" }} />
              </div>
              <div className="flex items-center gap-3 mb-2.5">
                <h3 className="font-semibold text-lg" style={{ color: "var(--text-2, #d8d8d8)" }}>
                  The Mobile App
                </h3>
                <span
                  className="text-[10px] font-bold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full"
                  style={{ color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.3)", background: "rgba(167,139,250,0.08)" }}
                >
                  On the way
                </span>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                iOS and Android apps are in the works. Shoot a video on your phone, drop it straight
                into your workspace, approve a post from the checkout line, and get a ping when your
                content goes live. Same account, same brain, wherever you are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Engines preview */}
      <section className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
            Powered by six engines
          </h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--text-4, #9a9a9a)" }}>
            AERA is not a scheduler with a chatbot bolted on. It is a system that thinks before it posts.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-3">
          {ENGINE_PREVIEW.map((e) => (
            <div key={e.title} className="mkt-card mkt-line-cyan p-7">
              <div
                className="w-11 h-11 rounded-xl mb-5 flex items-center justify-center"
                style={{ background: "rgba(45,212,255,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <e.icon style={{ width: 18, height: 18, color: "#2dd4ff" }} />
              </div>
              <h3 className="font-semibold mb-2.5" style={{ color: "var(--text-2, #d8d8d8)" }}>
                {e.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                {e.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link
            href="/engines"
            className="mkt-btn inline-flex items-center gap-2 text-sm font-semibold px-7 py-3 rounded-full"
            style={{ border: "1px solid rgba(45,212,255,0.3)", color: "#7fd9f7", background: "rgba(45,212,255,0.06)" }}
          >
            Explore all six engines
            <ArrowRight style={{ width: 15, height: 15 }} />
          </Link>
        </div>
      </section>

      <CtaBand
        title="Already a client?"
        sub="Your workspace is live and AERA is already working. Step inside."
        cta="Sign in to your dashboard"
      />

      <MarketingFooter />
    </main>
  );
}
