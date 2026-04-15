"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, TrendingUp, Zap, Target, BarChart3, Users, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Greeting } from "@/components/dashboard/Greeting";
import { useClientMemory } from "@/context/ClientMemory";
import { PagePad } from "@/components/layout/PagePad";

type MetricItem = {
  label: string;
  value: string;
  delta: string;
  insight: string;
  sub: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>;
};

const activity = [
  { type: "Campaign", name: "Q2 Brand Launch — Video Series",        status: "Active",   time: "2h ago",     href: "/campaigns"  },
  { type: "Content",  name: "8 × Instagram carousel posts delivered", status: "Complete", time: "Yesterday",  href: "/history"    },
  { type: "Analysis", name: "AERA voice audit — March report ready",  status: "Complete", time: "2 days ago", href: "/history"    },
  { type: "Campaign", name: "Email nurture sequence — Phase 2",       status: "Review",   time: "3 days ago", href: "/campaigns"  },
];

/* ─────────────────────────────────────────────────────────────
   Signal health system
   Maps live metrics → a signal level → accent color.
   Color palette is restrained: dominant palette is always
   deep black + charcoal + cyan/silver. Accent colors appear
   only as soft glows and data-dot highlights.

   healthy     → Cyan / Silver    — calm, steady orbit
   opportunity → Soft amber       — one ring side brightens subtly
   caution     → Muted rose       — gentle tint on outer ring
   critical    → Deep crimson     — very rare, restrained
───────────────────────────────────────────────────────────── */
type SignalLevel = "healthy" | "opportunity" | "caution" | "critical";

const SIGNAL: Record<SignalLevel, { color: string; glow: string; label: string }> = {
  healthy:     { color: "#2DD4FF", glow: "rgba(45,212,255,0.10)",  label: "All Signals Healthy"   },
  opportunity: { color: "#F59E0B", glow: "rgba(245,158,11,0.08)",  label: "Opportunity Detected"  },
  caution:     { color: "#FB7185", glow: "rgba(251,113,133,0.08)", label: "Signal Needs Attention" },
  critical:    { color: "#DC2626", glow: "rgba(220,38,38,0.08)",   label: "Critical Alert"         },
};

function computeSignal(velocity: string, roas: string, brandScore: string): SignalLevel {
  const v = parseFloat(velocity) || 0;
  const r = parseFloat(roas)     || 0;
  const b = parseFloat(brandScore.replace("%", "")) || 0;
  if (v >= 3.8 && r >= 6.5 && b >= 85) return "healthy";
  if (v >= 2.5 && r >= 4.0 && b >= 70) return "opportunity";
  if (v >= 1.5 && r >= 2.5 && b >= 55) return "caution";
  return "critical";
}

/* ── Animated orbit data dot ── */
function OrbitDot({
  orbitSize,
  duration,
  reverse,
  startAngle,
  dotSize,
  color,
  glowColor,
  label,
  pulseDuration,
}: {
  orbitSize: string;
  duration: string;
  reverse?: boolean;
  startAngle?: number;
  dotSize: number;
  color: string;
  glowColor: string;
  label?: string;
  pulseDuration?: string;
}) {
  const rotate = reverse ? "reverse" : "normal";
  return (
    <div
      className="absolute rounded-full flex items-center justify-center"
      style={{
        width: orbitSize, height: orbitSize,
        animation: `slowSpin ${duration} linear infinite ${rotate}`,
        transform: startAngle ? `rotate(${startAngle}deg)` : undefined,
      }}
    >
      <div style={{ position: "absolute", top: 0, left: "50%", transform: "translate(-50%, -50%)" }}>
        <div
          className="rounded-full"
          style={{
            width: dotSize, height: dotSize,
            background: color,
            boxShadow: `0 0 ${dotSize * 1.2}px ${glowColor}, 0 0 ${dotSize * 3}px ${glowColor}`,
            animation: pulseDuration ? `breathe ${pulseDuration} ease-in-out infinite` : undefined,
          }}
        />
        {label && (
          <div style={{
            position: "absolute",
            top: dotSize + 3,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 7,
            color: color,
            opacity: 0.7,
            letterSpacing: "0.08em",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}>
            {label}
          </div>
        )}
      </div>
    </div>
  );
}

function Hero({
  velocity, roas, brandScore,
}: {
  velocity: string;
  roas: string;
  brandScore: string;
}) {
  const signal     = computeSignal(velocity, roas, brandScore);
  const sig        = SIGNAL[signal];
  const isHealthy  = signal === "healthy";

  // Signal-color dot glow — used by OrbitDots
  const dotGlow = signal === "healthy"     ? "rgba(45,212,255,0.65)"
                : signal === "opportunity" ? "rgba(245,158,11,0.65)"
                : signal === "caution"     ? "rgba(251,113,133,0.65)"
                : "rgba(220,38,38,0.65)";

  // Ring border colors — use CSS variables so they're visible in both light and dark mode.
  // var(--border-mid) is dark on light backgrounds, faint on dark — always legible.
  // Signal-accent rings get a color overlay only when non-healthy.
  const outerRingColor = isHealthy
    ? "var(--border-mid)"
    : `rgba(${signal === "opportunity" ? "245,158,11" : signal === "caution" ? "251,113,133" : "220,38,38"},0.28)`;
  const cyanRingColor  = `rgba(45,212,255,${isHealthy ? "0.45" : "0.22"})`;
  const innerRingColor = "var(--border)";

  // Hero is always dark — it's a space/void aesthetic regardless of theme
  const heroBorder  = isHealthy ? "rgba(255,255,255,0.08)" : `rgba(${signal === "opportunity" ? "245,158,11" : signal === "caution" ? "251,113,133" : "220,38,38"},0.22)`;

  return (
    <div
      className="force-dark relative w-full overflow-hidden rounded-[18px] sm:rounded-[24px] h-[220px] sm:h-[290px] md:h-[360px]"
      style={{
        background: "linear-gradient(145deg, #0d0d10 0%, #050507 60%, #080b12 100%)",
        border: `1px solid ${heroBorder}`,
        boxShadow: "0 20px 64px rgba(0,0,0,0.65), 0 6px 20px rgba(0,0,0,0.45)",
        transition: "border-color 1.5s ease",
      }}
    >
      {/* Ambient bloom — base */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 65% 85% at 50% 50%, color-mix(in srgb, var(--text) 4%, transparent) 0%, transparent 60%)",
      }} />
      {/* Signal-reactive colored bloom — shifts with health level */}
      <div className="absolute inset-0" style={{
        background: `radial-gradient(ellipse 40% 52% at 50% 52%, ${sig.glow} 0%, transparent 68%)`,
        transition: "background 1.2s ease",
      }} />
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse 100% 80% at 50% 120%, rgba(45,212,255,0.025) 0%, transparent 55%)",
      }} />

      {/* Grid — theme-aware, elegant */}
      <div className="absolute inset-0" style={{
        backgroundImage:
          "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
        maskImage: "radial-gradient(ellipse 80% 85% at 50% 50%, black 10%, transparent 75%)",
        opacity: 0.5,
      }} />

      {/* Central APEX mark */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative flex items-center justify-center animate-float">

          {/* ── Outer ring — signal-reactive color ── */}
          <div
            className="absolute rounded-full border animate-spin-slow"
            style={{
              width: "min(170px, 44vw)", height: "min(170px, 44vw)",
              borderColor: outerRingColor,
              transition: "border-color 1.5s ease",
            }}
          />

          {/* ── Cyan ring ── */}
          <div
            className="absolute rounded-full border"
            style={{
              width: "min(118px, 31vw)", height: "min(118px, 31vw)",
              borderColor: cyanRingColor,
              animation: "slowSpin 26s linear infinite reverse",
            }}
          />

          {/* ── Inner ring ── */}
          <div
            className="absolute rounded-full border"
            style={{
              width: "min(80px, 21vw)", height: "min(80px, 21vw)",
              borderColor: innerRingColor,
              animation: "slowSpin 15s linear infinite",
            }}
          />

          {/* Core ambient glow */}
          <div className="absolute rounded-full"
            style={{
              width: "min(108px, 28vw)", height: "min(108px, 28vw)",
              background: `radial-gradient(circle, ${sig.glow.replace("0.10", "0.07").replace("0.08", "0.06")} 0%, transparent 70%)`,
              transition: "background 1.5s ease",
            }}
          />

          {/* ── APEX A mark ── */}
          <div className="relative z-10 flex items-center justify-center">
            <svg viewBox="0 0 64 64" fill="none" className="w-[40px] h-[40px] sm:w-[54px] sm:h-[54px] md:w-[68px] md:h-[68px]">
              <path d="M32 6L58 56H6L32 6Z"
                stroke="rgba(255,255,255,0.88)" strokeWidth="1.5" strokeLinejoin="round" fill="none" opacity="0.9" />
              <path d="M18 40H46"
                stroke="rgba(255,255,255,0.88)" strokeWidth="1.5" strokeLinecap="round" opacity="0.85" />
              <path d="M32 20L42 40"
                stroke="var(--text)" strokeWidth="1.2" strokeLinecap="round" opacity="0.22" />
              <path d="M32 20L22 40"
                stroke="var(--text)" strokeWidth="1.2" strokeLinecap="round" opacity="0.22" />
              {/* Apex dot — signal-reactive */}
              <circle cx="32" cy="6" r="2"   fill={sig.color} opacity="1" />
              <circle cx="32" cy="6" r="5.5" fill={sig.color} opacity="0.14" />
            </svg>
          </div>

          {/* ── Orbiting data dots ── */}
          {/* Primary signal dot — orbits outer ring, reacts to health level */}
          <OrbitDot
            orbitSize="min(186px, 48vw)"
            duration="20s"
            startAngle={35}
            dotSize={3.5}
            color={sig.color}
            glowColor={dotGlow}
            pulseDuration="2.6s"
          />
          {/* Secondary neutral dot — orbits inner ring, reverse direction */}
          <OrbitDot
            orbitSize="min(96px, 25vw)"
            duration="11s"
            reverse
            startAngle={200}
            dotSize={2.5}
            color="rgba(255,255,255,0.28)"
            glowColor="rgba(255,255,255,0.12)"
          />
        </div>
      </div>

      {/* Top-left status */}
      <div className="absolute top-5 left-5 sm:top-7 sm:left-8 flex flex-col gap-2">
        <p className="text-[9px] font-semibold tracking-[0.18em] uppercase" style={{ color: "var(--text-5)" }}>
          AERA Intelligence Layer
        </p>
        <div className="flex items-center gap-2">
          {/* Pulse dot — neutral (text-5) when healthy, signal-colored when alerting */}
          <div
            className="h-1.5 w-1.5 rounded-full animate-breathe-slow"
            style={{
              background: isHealthy ? "var(--text-5)" : sig.color,
              boxShadow: isHealthy ? "none" : `0 0 6px ${sig.color}99`,
              transition: "background 1s, box-shadow 1s",
            }}
          />
          <p className="text-[9.5px] font-medium tracking-wide" style={{
            color: isHealthy ? "var(--text-5)" : sig.color,
            transition: "color 1s",
          }}>
            {sig.label}
          </p>
        </div>
      </div>

      {/* Top-right stats */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-8 flex items-center gap-5 sm:gap-8">
        {[
          { label: "Velocity",  value: velocity,    show: true  },
          { label: "ROAS",      value: roas,         show: true  },
          { label: "Campaigns", value: "4",          show: false },
        ].map((s) => (
          <div key={s.label} className={`text-right ${s.show ? "" : "hidden sm:block"}`}>
            <div
              suppressHydrationWarning
              className="text-[15px] sm:text-[18px] font-bold leading-none"
              style={{ color: "var(--text)", letterSpacing: "-0.03em" }}
            >
              {s.value}
            </div>
            <div className="text-[8px] uppercase tracking-[0.14em] mt-1" style={{ color: "var(--text-6)" }}>
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom meta */}
      <div className="absolute bottom-5 left-5 right-5 sm:bottom-6 sm:left-8 sm:right-8 flex items-end justify-between">
        <p className="text-[8.5px] font-mono" style={{ color: "var(--text-6)" }}>APEX AERA v2.1 · Q2 2026</p>
        <p className="text-[8.5px]" style={{ color: "var(--text-6)" }}>Intelligence Layer · Active</p>
      </div>

      {/* Bottom signal hairline — reactive */}
      <div
        className="absolute bottom-0 left-1/4 right-1/4 h-px"
        style={{
          background: `linear-gradient(90deg, transparent, ${sig.color}44, transparent)`,
          transition: "background 1.5s ease",
        }}
      />
      {/* Top inset highlight */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
      />
    </div>
  );
}

function KPICard({ m, index }: { m: MetricItem; index: number }) {
  const [hovered, setHovered] = useState(false);
  const Icon = m.icon;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="group relative flex flex-col rounded-[16px] border cursor-default opacity-0 animate-fade-in-up"
      style={{
        padding: "26px 24px 24px",
        background: hovered ? "var(--hover-fill-cyan)" : "var(--surface)",
        borderColor: hovered ? "rgba(45,212,255,0.16)" : "var(--border)",
        boxShadow: hovered ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        animationDelay: `${0.28 + index * 0.06}s`,
        animationFillMode: "forwards",
        transition: "background 0.3s, box-shadow 0.3s, border-color 0.3s",
        // No overflow-hidden — allows the insight panel to expand freely
        // and lets wheel events propagate to the page scroll container
      }}
    >
      {/* Top cyan edge */}
      <div
        className="absolute top-0 left-6 right-6 h-px rounded-full"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.45), transparent)",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s",
        }}
      />

      {/* Icon row + delta */}
      <div className="flex items-center justify-between mb-5">
        <div
          className="h-8 w-8 rounded-[9px] flex items-center justify-center"
          style={{
            background: hovered ? "rgba(45,212,255,0.06)" : "var(--surface-3)",
            border: `1px solid ${hovered ? "rgba(45,212,255,0.14)" : "var(--border)"}`,
            transition: "background 0.25s, border-color 0.25s",
          }}
        >
          <Icon
            className="h-[14px] w-[14px]"
            style={{ color: hovered ? "var(--cyan)" : "var(--text-5)", transition: "color 0.25s" }}
            strokeWidth={1.6}
          />
        </div>
        <span
          className="text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-full"
          style={{
            color: "#2DD4FF",
            background: "rgba(45,212,255,0.07)",
            border: "1px solid rgba(45,212,255,0.14)",
            letterSpacing: "0.01em",
          }}
        >
          {m.delta}
        </span>
      </div>

      {/* Value + label */}
      <div>
        <div
          suppressHydrationWarning
          style={{
            fontSize: "clamp(32px, 4vw, 40px)",
            fontWeight: 800,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            color: "var(--text)",
            fontFeatureSettings: '"tnum"',
          }}
        >
          {m.value}
        </div>
        <div
          className="text-[13px] font-medium mt-3"
          style={{ color: hovered ? "var(--text-3)" : "var(--text-4)", transition: "color 0.25s" }}
        >
          {m.label}
        </div>
        <div className="text-[11px] mt-1" style={{ color: "var(--text-6)" }}>
          {m.sub}
        </div>
      </div>

      {/* ── AERA Insight panel — slides in on hover ── */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: hovered ? 220 : 0,
          opacity: hovered ? 1 : 0,
          marginTop: hovered ? 16 : 0,
          transition: "max-height 0.42s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease, margin-top 0.3s ease",
        }}
      >
        <div
          style={{
            padding: "12px 14px",
            borderRadius: 10,
            background: "rgba(45,212,255,0.04)",
            border: "1px solid rgba(45,212,255,0.10)",
          }}
        >
          {/* AERA label */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: "#2DD4FF",
              boxShadow: "0 0 5px rgba(45,212,255,0.8)",
            }} />
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: "0.16em",
              textTransform: "uppercase", color: "var(--cyan)",
            }}>
              AERA Analysis
            </span>
          </div>
          <p style={{
            fontSize: 11.5,
            color: "var(--text-4)",
            lineHeight: 1.65,
            letterSpacing: "0.005em",
          }}>
            {m.insight}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { memory } = useClientMemory();
  const { velocity, roas, seoLift, brandScore } = memory.campaignStats;

  const metrics: MetricItem[] = [
    {
      label: "Content Velocity", value: velocity, delta: "+18%", sub: "vs. baseline", icon: Zap,
      insight: "Running 18% above your Q1 baseline — driven by the Video Series and Blog campaigns operating simultaneously. AERA recommends maintaining 2–3 active briefs per cycle to sustain this pace without straining creative resources.",
    },
    {
      label: "ROAS", value: roas, delta: "+23%", sub: "Return on ad spend", icon: TrendingUp,
      insight: "Exceptional return on ad spend. The Q2 Brand Video is your top performer at 11.4×. Paid social retargeting, currently in planning, is projected to bring the blended ROAS to 9×+ once launched in late April.",
    },
    {
      label: "Conversion Rate", value: "4.6%", delta: "+0.9pt", sub: "Landing page avg.", icon: Target,
      insight: "Up 0.9 points from last quarter — the Email Nurture Phase 1 sequence is the primary driver. AERA projects a 5.1% conversion rate by end of Q2 if the Phase 2 sequence launches on schedule.",
    },
    {
      label: "Engagement", value: "12.3%", delta: "+5.1pt", sub: "Cross-channel avg.", icon: Activity,
      insight: "5.1 points above baseline. Short-form video on Instagram and LinkedIn is outperforming written content by 3×. AERA recommends shifting 20% of content budget toward video formats to sustain this lift.",
    },
    {
      label: "Brand Search", value: seoLift, delta: "+12%", sub: "Organic search lift", icon: BarChart3,
      insight: "Organic lift driven by the Thought Leadership Blog Series — 34 new backlinks acquired this quarter. Top article: 'AI-Native Marketing in 2026' with 840 unique sessions. Average SERP position improved to 3.2.",
    },
    {
      label: "Audience Reach", value: "2.1M", delta: "+340K", sub: "Unique impressions", icon: Users,
      insight: "340K new unique impressions vs. last quarter. The YouTube brand video accounts for 48% of new reach. Cross-platform audience overlap is just 12%, indicating strong, healthy discovery across channels.",
    },
  ];

  return (
    <PagePad>
    <div className="flex flex-col gap-10 sm:gap-14">

      {/* ── Greeting ── */}
      <div
        className="opacity-0 animate-fade-in-up"
        style={{ animationFillMode: "forwards" }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div>
            <p
              className="text-[10px] font-semibold tracking-[0.2em] uppercase mb-4"
              style={{ color: "var(--cyan)" }}
            >
              March 2026 · Intelligence Overview
            </p>
            <Greeting />
            <p
              className="text-[15px] mt-3 font-normal leading-relaxed max-w-[400px]"
              style={{ color: "var(--text-5)", letterSpacing: "0.005em" }}
            >
              Your brand is at peak velocity. AERA is active and watching every signal.
            </p>
          </div>
          <div className="flex items-center gap-2.5 sm:shrink-0 sm:pb-1">
            <Link href="/conference?report=full">
              <Button variant="outline" size="sm">Full Report</Button>
            </Link>
            <Link href="/chat?brief=1">
              <Button variant="primary" size="sm">
                Brief AERA <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div
        className="opacity-0 animate-fade-in-up delay-150"
        style={{ animationFillMode: "forwards" }}
      >
        <Hero velocity={velocity} roas={roas} brandScore={brandScore} />
      </div>

      {/* ── KPIs ── */}
      <div
        className="opacity-0 animate-fade-in-up delay-200"
        style={{ animationFillMode: "forwards" }}
      >
        <div className="flex items-baseline justify-between mb-6">
          <span className="section-label">Key Performance Indicators</span>
          <p className="text-[11px]" style={{ color: "var(--text-6)" }}>Updated 2 hours ago</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m, i) => (
            <KPICard key={m.label} m={m} index={i} />
          ))}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div
        className="grid md:grid-cols-5 gap-5 opacity-0 animate-fade-in-up delay-400"
        style={{ animationFillMode: "forwards" }}
      >
        {/* Activity */}
        <div
          className="md:col-span-3 rounded-[18px] border overflow-hidden"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            className="px-6 sm:px-7 py-5 flex items-center justify-between"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="section-label">Recent Activity</span>
            <Link href="/history">
              <Button variant="ghost" size="sm">View all</Button>
            </Link>
          </div>
          <div>
            {activity.map((item, i) => (
              <ActivityRow key={i} item={item} i={i} />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div
          className="md:col-span-2 rounded-[18px] border overflow-hidden"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <div
            className="px-6 sm:px-7 py-5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span className="section-label">Quick Actions</span>
          </div>
          <div className="p-3 flex flex-col gap-1">
            {[
              { label: "Brief a new campaign",  accent: false, href: "/campaigns" },
              { label: "Ask AERA",              accent: true,  href: "/chat"       },
              { label: "Content Velocity",      accent: false, href: "/agents"     },
              { label: "View deliverables",     accent: false, href: "/history"    },
              { label: "Contact team",          accent: false, href: "/contact"    },
            ].map(({ label, accent, href }) => (
              <QuickAction key={label} label={label} accent={accent} href={href} />
            ))}
          </div>
        </div>
      </div>
    </div>
    </PagePad>
  );
}

function ActivityRow({ item, i }: { item: typeof activity[0]; i: number }) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => router.push(item.href)}
      className="flex items-center gap-3 px-4 sm:px-7 py-4 cursor-pointer"
      style={{
        borderBottom: i < activity.length - 1 ? "1px solid var(--border)" : "none",
        background: hovered ? "var(--hover-fill-cyan)" : "transparent",
        transition: "background 0.18s",
      }}
    >
      <div
        className="h-8 w-8 rounded-[9px] flex items-center justify-center shrink-0"
        style={{
          background: hovered ? "rgba(45,212,255,0.05)" : "var(--surface-2)",
          border: `1px solid ${hovered ? "rgba(45,212,255,0.12)" : "var(--border)"}`,
          transition: "background 0.18s, border-color 0.18s",
        }}
      >
        <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: "var(--text-5)" }}>
          {item.type.slice(0, 2)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-[13px] font-normal truncate"
          style={{
            color: hovered ? "var(--text-2)" : "var(--text-3)",
            transition: "color 0.18s",
            letterSpacing: "-0.005em",
          }}
        >
          {item.name}
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--text-6)" }}>{item.time}</p>
      </div>
      <span
        className="text-[10px] font-medium px-2.5 py-1 rounded-full shrink-0"
        style={{
          color: item.status === "Active"
            ? "#2DD4FF"
            : item.status === "Complete"
            ? "var(--text-5)"
            : "var(--text-6)",
          background: item.status === "Active" ? "rgba(45,212,255,0.07)" : "var(--surface-2)",
          border: `1px solid ${item.status === "Active" ? "rgba(45,212,255,0.16)" : "var(--border)"}`,
          letterSpacing: "0.01em",
        }}
      >
        {item.status}
      </span>
    </div>
  );
}

function QuickAction({ label, accent, href }: { label: string; accent: boolean; href: string }) {
  const [hovered, setHovered] = useState(false);
  const router = useRouter();
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => router.push(href)}
      className="w-full text-left px-4 py-3 rounded-[10px] border transition-all duration-150"
      style={{
        fontSize: 13,
        letterSpacing: "-0.005em",
        color: hovered
          ? accent ? "var(--cyan)" : "var(--text-2)"
          : accent ? "var(--cyan-dim)" : "var(--text-5)",
        borderColor: hovered
          ? accent ? "rgba(45,212,255,0.18)" : "var(--border)"
          : "transparent",
        background: hovered
          ? accent ? "rgba(45,212,255,0.05)" : "var(--hover-fill-cyan)"
          : "transparent",
        transition: "color 0.15s, background 0.15s, border-color 0.15s",
      }}
    >
      {label}
    </button>
  );
}
