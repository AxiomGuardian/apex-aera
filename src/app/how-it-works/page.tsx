import type { Metadata } from "next";
import { Upload, Brain, PenLine, Send, Zap } from "lucide-react";
import { MarketingNav, MarketingFooter, PageHeader, CtaBand } from "@/components/marketing/Shell";

export const metadata: Metadata = {
  title: "How it works | APEX AERA",
  description: "Upload your content, AERA studies it, writes it, schedules it, publishes it, and reports back. Autopilot by default.",
};

const STEPS = [
  {
    n: "01",
    icon: Upload,
    title: "Drop in your content",
    body: "Shoot your video, grab your creative, and drop it into your workspace. Add a sentence about what it is if you like, or say nothing at all. Raw footage is welcome. That is the whole job on your end.",
  },
  {
    n: "02",
    icon: Brain,
    title: "AERA studies everything",
    body: "It watches the video frame by frame, transcribes the audio, reads your brand profile, and pulls the latest trend research for your niche. By the time it starts writing, it knows your content, your voice, and your market.",
  },
  {
    n: "03",
    icon: PenLine,
    title: "It writes and schedules",
    body: "AERA writes a distinct caption for each platform, picks the posting windows that fit your audience, and books every post with a clear date and time in your timezone. The calendar fills itself.",
  },
  {
    n: "04",
    icon: Send,
    title: "It publishes and reports back",
    body: "When a post comes due, it goes out to the connected platform automatically. Then AERA keeps the receipts: what published, what is coming next, and a weekly digest written only from real numbers.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-deep, #0c0c0c)", color: "var(--text, #e8e8e8)" }}>
      <MarketingNav />
      <PageHeader
        kicker="How it works"
        title="You upload. It handles the rest."
        sub="Four steps, and only the first one is yours. Everything after happens on its own, around the clock."
      />

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-4">
        <div className="relative">
          <div
            className="absolute left-[27px] top-6 bottom-6 w-px hidden sm:block"
            style={{ background: "linear-gradient(180deg, rgba(45,212,255,0.5), rgba(45,212,255,0.06))" }}
          />
          <div className="flex flex-col gap-6">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                className="mkt-reveal relative flex gap-6 items-start"
                style={{ animationDelay: (0.05 + i * 0.09).toFixed(2) + "s" }}
              >
                <div
                  className="relative z-10 w-14 h-14 rounded-2xl shrink-0 hidden sm:flex items-center justify-center"
                  style={{
                    background: "rgba(45,212,255,0.07)",
                    border: "1px solid rgba(45,212,255,0.25)",
                    boxShadow: "0 0 24px rgba(45,212,255,0.10)",
                  }}
                >
                  <s.icon style={{ width: 20, height: 20, color: "#2dd4ff" }} />
                </div>
                <div className="mkt-card mkt-line-cyan flex-1 p-7">
                  <div className="text-xs font-bold tracking-[0.25em] mb-3" style={{ color: "#5ecdf0" }}>
                    {s.n}
                  </div>
                  <h3 className="font-semibold text-lg mb-2.5" style={{ color: "var(--text-2, #d8d8d8)" }}>
                    {s.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Autopilot */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <div className="mkt-card mkt-line-amber p-8 sm:p-10">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Zap style={{ width: 18, height: 18, color: "#fbbf24" }} />
            </div>
            <h3 className="font-semibold text-lg" style={{ color: "var(--text-2, #d8d8d8)" }}>
              Autopilot by default
            </h3>
          </div>
          <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--text-4, #9a9a9a)" }}>
            Nothing sits around waiting for a thumbs up. Once AERA schedules a post, it is approved
            and on its way. Your queue shows you everything that is coming, and you can pull any
            post before it goes out if you change your mind.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
            Prefer a heavier hand? Any workspace can be switched to manual approval, and every post
            waits for your yes before it moves. Your platform, your rules.
          </p>
        </div>
      </section>

      <CtaBand
        title="Watch it work."
        sub="The pipeline runs behind the portal every few minutes, day and night."
        cta="Sign in to your dashboard"
      />
      <MarketingFooter />
    </main>
  );
}
