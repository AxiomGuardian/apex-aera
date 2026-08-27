import type { Metadata } from "next";
import Link from "next/link";
import { Radar, ScanEye, PenLine, CalendarClock, Send, BarChart3, ArrowRight } from "lucide-react";
import { MarketingNav, MarketingFooter, PageHeader, CtaBand } from "@/components/marketing/Shell";

export const metadata: Metadata = {
  title: "Engines | APEX AERA",
  description: "The six engines behind AERA: trend research, content intelligence, captions, scheduling, publishing, and reporting.",
};

const ENGINES = [
  {
    icon: Radar,
    accent: "mkt-line-cyan",
    color: "#2dd4ff",
    bg: "rgba(45,212,255,0.08)",
    title: "Trend Research",
    body: "Before AERA writes a single word, it goes out and looks. It scans the live web and X for what is moving in your niche this week, the topics gaining heat, the formats winning attention, and the conversations your audience is already having. That research becomes a fresh brief for your brand.",
    detail: "In your dashboard: a living trend brief per brand, refreshed weekly or on demand.",
  },
  {
    icon: ScanEye,
    accent: "mkt-line-green",
    color: "#34d399",
    bg: "rgba(52,211,153,0.08)",
    title: "Content Intelligence",
    body: "Upload a video and AERA actually watches it. It pulls frames to see what is on screen, listens to the audio and writes a transcript, and reads any notes you add. It knows the difference between a product demo and a day in the life, because it looked.",
    detail: "In your dashboard: a full analysis per upload with platform fit and posting windows.",
  },
  {
    icon: PenLine,
    accent: "mkt-line-violet",
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.08)",
    title: "Caption Studio",
    body: "Every platform gets its own angle. The Instagram caption hooks different from the TikTok one, the LinkedIn post reads like it belongs there, and none of them lean on filler. AERA writes from what is in the content and what is moving in your market, in your brand voice.",
    detail: "In your dashboard: captions per platform with one tap regeneration for a fresh take.",
  },
  {
    icon: CalendarClock,
    accent: "mkt-line-amber",
    color: "#fbbf24",
    bg: "rgba(251,191,36,0.08)",
    title: "Autonomous Scheduling",
    body: "AERA turns recommended posting windows into a real calendar. Each post gets a date, a time, and a timezone you can read at a glance. Content flows into the queue on its own, spaced and sequenced so your channels stay alive without flooding anyone.",
    detail: "In your dashboard: every scheduled post with its exact local time, ready in the queue.",
  },
  {
    icon: Send,
    accent: "mkt-line-cyan",
    color: "#2dd4ff",
    bg: "rgba(45,212,255,0.08)",
    title: "Publishing",
    body: "When a post is due, it goes out. Connected platforms publish automatically at the scheduled moment, day or night. The system checks in every few minutes around the clock, so nothing waits for someone to remember to hit a button.",
    detail: "In your dashboard: live status per post, from queued to published.",
  },
  {
    icon: BarChart3,
    accent: "mkt-line-rose",
    color: "#fb7185",
    bg: "rgba(251,113,133,0.08)",
    title: "Honest Reporting",
    body: "Reports are written from the real numbers in your account and nothing else. AERA will tell you what went out, what is queued, and what it noticed. What it will never do is invent a metric to make a week look better than it was.",
    detail: "In your dashboard: weekly digests you can generate any time you want a pulse check.",
  },
];

export default function EnginesPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-deep, #0c0c0c)", color: "var(--text, #e8e8e8)" }}>
      <MarketingNav />
      <PageHeader
        kicker="The Engines"
        title="One companion. Six engines."
        sub="AERA is a single brand companion built from six specialized engines. Each one does a job a marketing team member would do, and they run together on their own."
      />
      {/* The system behind the engines */}
      <section className="mx-auto max-w-4xl px-5 sm:px-6 pb-12 sm:pb-14 pt-2">
        <div className="mkt-card mkt-line-cyan p-6 sm:p-10">
          <h2 className="font-semibold text-lg mb-3" style={{ color: "var(--text-2, #d8d8d8)" }}>
            First, what the system actually is
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-4, #9a9a9a)" }}>
            AERA is one system, not six separate tools. When content enters your workspace, it moves
            through a single pipeline: the research informs the writing, the writing fills the
            calendar, the calendar drives the publishing, and the publishing feeds the reports. Each
            engine below handles one leg of that trip.
          </p>
          <p className="text-sm leading-relaxed mb-7" style={{ color: "var(--text-4, #9a9a9a)" }}>
            The whole loop runs on its own every few minutes, day and night, for every workspace on
            the platform. You upload. It carries everything from there.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-7">
            {["Research", "Watch", "Write", "Schedule", "Publish", "Report"].map((step, i) => (
              <span key={step} className="flex items-center gap-2">
                <span
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full"
                  style={{ color: "#9be7ff", border: "1px solid rgba(45,212,255,0.28)", background: "rgba(45,212,255,0.06)" }}
                >
                  {step}
                </span>
                {i < 5 && <ArrowRight style={{ width: 13, height: 13, color: "rgba(45,212,255,0.45)" }} />}
              </span>
            ))}
          </div>
          <Link
            href="/how-it-works"
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: "#7fd9f7" }}
          >
            Walk through the full pipeline
            <ArrowRight style={{ width: 14, height: 14 }} />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 sm:px-6 pb-16 sm:pb-20 pt-4">
        <div className="grid gap-5 md:grid-cols-2">
          {ENGINES.map((e, i) => (
            <div
              key={e.title}
              className="mkt-card mkt-quiet mkt-reveal p-6 sm:p-8"
              style={{ animationDelay: (0.05 + i * 0.06).toFixed(2) + "s" }}
            >
              <div className="flex items-center gap-4 mb-4">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: e.bg, border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <e.icon style={{ width: 18, height: 18, color: e.color }} />
                </div>
                <h3 className="font-semibold text-lg" style={{ color: "var(--text-2, #d8d8d8)" }}>
                  {e.title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "var(--text-4, #9a9a9a)" }}>
                {e.body}
              </p>
              <p className="text-xs leading-relaxed pt-3" style={{ color: "var(--text-5, #6e6e6e)", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {e.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
      <CtaBand
        title="See them run."
        sub="The engines are already live behind the portal, working for every workspace."
        cta="Sign in to your dashboard"
      />
      <MarketingFooter />
    </main>
  );
}
