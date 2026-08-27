import type { Metadata } from "next";
import {
  FolderOpen, ListChecks, MessageSquare, Radar, FileText, Filter,
  Users, Fingerprint, Link2, Globe, LogIn, LayoutDashboard, ArrowRight, Monitor, Smartphone,
} from "lucide-react";
import { MarketingNav, MarketingFooter, PageHeader, CtaBand } from "@/components/marketing/Shell";

export const metadata: Metadata = {
  title: "Platform | APEX AERA",
  description: "Everything inside the APEX AERA portal: content library, queue, AERA chat, trend briefs, reports, funnels, and team onboarding.",
};

const FEATURES = [
  { icon: FolderOpen, title: "Content Library", body: "Every upload in one place with its analysis, captions, and schedule attached to it." },
  { icon: ListChecks, title: "The Queue", body: "Everything scheduled to go out, with exact dates and times. Pull anything before it publishes." },
  { icon: MessageSquare, title: "AERA Chat", body: "Talk to your brand companion directly. Ask questions, brainstorm, and steer the strategy." },
  { icon: Radar, title: "Trend Briefs", body: "Fresh research on your niche from the live web and X, kept per brand and refreshed weekly." },
  { icon: FileText, title: "Reports", body: "Weekly digests written only from the real activity in your account. No invented numbers, ever." },
  { icon: Filter, title: "Funnel Drafts", body: "AERA sketches landing page structures from your brand profile, ready to build on." },
  { icon: Users, title: "Team Onboarding", body: "Invite a client by email. They set a name and password and land in their own workspace." },
  { icon: Fingerprint, title: "Brand Profiles", body: "Tone, audience, and website per brand. AERA reads it before every single analysis." },
  { icon: Link2, title: "Platform Connections", body: "Connect social accounts per brand. Publishing activates the moment a platform is linked." },
];

const FLOW = [
  { icon: Globe, title: "The front page", body: "Where you are right now. What APEX is, out in the open." },
  { icon: LogIn, title: "The sign in portal", body: "One door for everyone. Operators, brands, and enterprise all enter here." },
  { icon: LayoutDashboard, title: "Your dashboard", body: "Your workspace, your content, your queue, and AERA at your side." },
];

export default function PlatformPage() {
  return (
    <main className="min-h-screen" style={{ background: "var(--bg-deep, #0c0c0c)", color: "var(--text, #e8e8e8)" }}>
      <MarketingNav />
      <PageHeader
        kicker="The Platform"
        title="Everything lives in one portal."
        sub="No tab juggling, no tool sprawl. Your content, your calendar, your intelligence, and your team, all behind one sign in on one domain."
      />

      {/* One domain flow */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-4">
        <div className="grid gap-5 sm:grid-cols-3">
          {FLOW.map((f, i) => (
            <div key={f.title} className="relative">
              <div
                className="mkt-card mkt-reveal mkt-line-cyan p-7 h-full"
                style={{ animationDelay: (0.05 + i * 0.08).toFixed(2) + "s" }}
              >
                <div
                  className="w-11 h-11 rounded-xl mb-5 flex items-center justify-center"
                  style={{ background: "rgba(45,212,255,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <f.icon style={{ width: 18, height: 18, color: "#2dd4ff" }} />
                </div>
                <h3 className="font-semibold mb-2.5" style={{ color: "var(--text-2, #d8d8d8)" }}>
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                  {f.body}
                </p>
              </div>
              {i < FLOW.length - 1 && (
                <div className="hidden sm:flex absolute top-1/2 -right-[22px] z-10 items-center justify-center">
                  <ArrowRight style={{ width: 16, height: 16, color: "rgba(45,212,255,0.5)" }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative mkt-grid">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 55% 60% at 50% 0%, rgba(45,212,255,0.05) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: "var(--text, #ececec)" }}>
              Inside the portal
            </h2>
            <p className="mt-3 text-sm sm:text-base" style={{ color: "var(--text-4, #9a9a9a)" }}>
              What you find on the other side of the sign in.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="mkt-card mkt-line-cyan p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: "rgba(45,212,255,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <f.icon style={{ width: 15, height: 15, color: "#2dd4ff" }} />
                  </div>
                  <h3 className="font-semibold text-sm" style={{ color: "var(--text-2, #d8d8d8)" }}>
                    {f.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Access */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="mkt-card mkt-line-cyan p-8">
            <div className="flex items-center gap-3 mb-3">
              <Monitor style={{ width: 17, height: 17, color: "#2dd4ff" }} />
              <h3 className="font-semibold" style={{ color: "var(--text-2, #d8d8d8)" }}>Web portal, live today</h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
              The full experience runs in your browser on this domain. Sign in from any computer and
              your whole operation is waiting for you.
            </p>
          </div>
          <div className="mkt-card mkt-line-violet p-8">
            <div className="flex items-center gap-3 mb-3">
              <Smartphone style={{ width: 17, height: 17, color: "#a78bfa" }} />
              <h3 className="font-semibold" style={{ color: "var(--text-2, #d8d8d8)" }}>Mobile app, on the way</h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-4, #9a9a9a)" }}>
              iOS and Android apps are in the works, so you can upload from your camera roll, watch
              the queue, and hear from AERA wherever the day takes you.
            </p>
          </div>
        </div>
      </section>

      <CtaBand
        title="One domain. One door."
        sub="If you have an invitation, your workspace is already waiting."
        cta="Enter the portal"
      />
      <MarketingFooter />
    </main>
  );
}
