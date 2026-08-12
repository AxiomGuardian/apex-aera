import Link from "next/link";

/**
 * APEX AERA — Public front page (apexaera.com)
 * Dark, quiet, premium. Sign-in portal top right → /login → dashboard.
 * No fabricated stats, no fake logos, no invented testimonials.
 */

const ENGINES = [
  {
    title: "Trend Research",
    body: "AERA scours the live web and X for what is moving in your niche right now — fresh briefs, not stale templates.",
  },
  {
    title: "Content Intelligence",
    body: "Upload a video and AERA watches it — frames, audio, transcript — and understands what it is actually about.",
  },
  {
    title: "Caption Studio",
    body: "A distinct angle for every platform. Instagram is not TikTok is not LinkedIn, and AERA writes like it knows the difference.",
  },
  {
    title: "Autonomous Scheduling",
    body: "Your posting windows become a living calendar. Content is timed, queued, and sequenced without you touching it.",
  },
  {
    title: "Publishing",
    body: "When a post is due, it goes out. Connected platforms publish automatically — around the clock, in your timezone.",
  },
  {
    title: "Honest Reporting",
    body: "Reports built only from real numbers in your account. AERA never invents a metric to look good.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Drop in your content",
    body: "Upload raw video or creative. Add a sentence about it if you like — or don't.",
  },
  {
    n: "02",
    title: "AERA studies everything",
    body: "It analyzes your content, reads your brand profile, and researches your market before writing a word.",
  },
  {
    n: "03",
    title: "It runs itself",
    body: "Captions, schedules, publishing, reports. On autopilot by default — you watch it work from your dashboard.",
  },
];

function ApexMark({ size = 26 }: { size?: number }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" width={size} height={size} aria-hidden>
      <path
        d="M14 3L26 24H2L14 3Z"
        stroke="rgba(45,212,255,0.9)"
        strokeWidth="1.4"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function HomePage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-deep, #0c0c0c)", color: "var(--text, #e8e8e8)" }}>
      {/* ── Nav ── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md"
        style={{ background: "rgba(12,12,12,0.82)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}
      >
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ApexMark />
            <span className="font-semibold tracking-[0.18em] text-sm" style={{ color: "var(--text, #e8e8e8)" }}>
              APEX&nbsp;AERA
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <a href="#engines" className="hidden sm:block text-sm transition-colors hover:text-white" style={{ color: "var(--text-4, #9a9a9a)" }}>
              Engines
            </a>
            <a href="#how" className="hidden sm:block text-sm transition-colors hover:text-white" style={{ color: "var(--text-4, #9a9a9a)" }}>
              How it works
            </a>
            <Link
              href="/login"
              className="text-sm font-medium px-4 py-2 rounded-full transition-all hover:brightness-110"
              style={{
                background: "rgba(45,212,255,0.12)",
                border: "1px solid rgba(45,212,255,0.35)",
                color: "#9be7ff",
                boxShadow: "0 0 24px rgba(45,212,255,0.10)",
              }}
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(45,212,255,0.09) 0%, transparent 65%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28 text-center">
          <p
            className="inline-block text-[11px] tracking-[0.28em] uppercase mb-6 px-4 py-1.5 rounded-full"
            style={{ color: "#7fd9f7", border: "1px solid rgba(45,212,255,0.25)", background: "rgba(45,212,255,0.06)" }}
          >
            Agentic AI Marketing
          </p>
          <h1
            className="font-extrabold leading-[1.05] tracking-tight text-4xl sm:text-6xl"
            style={{ color: "var(--text, #ececec)" }}
          >
            Your marketing,
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #2DD4FF 0%, #8be9ff 60%, #d7f7ff 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              running itself.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
            APEX AERA studies your brand, researches your market in real time, writes
            platform-native content, schedules it, publishes it, and reports on it —
            24 hours a day, while you run your business.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="text-sm font-semibold px-7 py-3 rounded-full transition-all hover:brightness-110"
              style={{
                background: "linear-gradient(180deg, rgba(45,212,255,0.95), rgba(24,160,200,0.95))",
                color: "#04131a",
                boxShadow: "0 8px 32px rgba(45,212,255,0.25)",
              }}
            >
              Enter the portal
            </Link>
            <a
              href="#how"
              className="text-sm font-medium px-7 py-3 rounded-full transition-colors hover:text-white"
              style={{ border: "1px solid rgba(255,255,255,0.14)", color: "var(--text-3, #bebebe)" }}
            >
              See how it works
            </a>
          </div>
          <p className="mt-8 text-xs tracking-wide" style={{ color: "var(--text-5, #6e6e6e)" }}>
            Access is by invitation. Every client workspace is private and qualified.
          </p>
        </div>
      </section>

      {/* ── Engines ── */}
      <section id="engines" className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
            One brand companion. Six engines.
          </h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--text-4, #9a9a9a)" }}>
            AERA is not a scheduler with a chatbot bolted on. It is a system that thinks before it posts.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ENGINES.map((e) => (
            <div
              key={e.title}
              className="rounded-2xl p-6 transition-colors"
              style={{ background: "var(--surface, #1a1a1a)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div
                className="w-9 h-9 rounded-full mb-4 flex items-center justify-center"
                style={{ background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.25)" }}
              >
                <ApexMark size={16} />
              </div>
              <h3 className="font-semibold mb-2" style={{ color: "var(--text-2, #d8d8d8)" }}>
                {e.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                {e.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="relative">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 100%, rgba(45,212,255,0.05) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="mb-12 text-center">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
              How it works
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="rounded-2xl p-6"
                style={{ background: "var(--bg-raised, #141414)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="text-xs font-semibold tracking-[0.25em] mb-4" style={{ color: "#5ecdf0" }}>
                  {s.n}
                </div>
                <h3 className="font-semibold mb-2" style={{ color: "var(--text-2, #d8d8d8)" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="mx-auto max-w-6xl px-6 pb-24 sm:pb-32">
        <div
          className="rounded-3xl px-8 py-14 sm:py-16 text-center"
          style={{
            background: "linear-gradient(180deg, rgba(45,212,255,0.07), rgba(20,20,20,0.6))",
            border: "1px solid rgba(45,212,255,0.18)",
          }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
            Already a client?
          </h2>
          <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--text-4, #9a9a9a)" }}>
            Your workspace is live and AERA is already working. Step inside.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-block text-sm font-semibold px-8 py-3 rounded-full transition-all hover:brightness-110"
            style={{
              background: "linear-gradient(180deg, rgba(45,212,255,0.95), rgba(24,160,200,0.95))",
              color: "#04131a",
              boxShadow: "0 8px 32px rgba(45,212,255,0.25)",
            }}
          >
            Sign in to your dashboard
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="mx-auto max-w-6xl px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ApexMark size={16} />
            <span className="text-xs tracking-[0.18em]" style={{ color: "var(--text-5, #6e6e6e)" }}>
              APEX AERA
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--text-6, #4e4e4e)" }}>
            © 2026 APEX AERA. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
