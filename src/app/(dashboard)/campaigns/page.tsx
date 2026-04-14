"use client";

import { Button } from "@/components/ui/button";
import { BrandIcon, brandColor } from "@/components/ui/BrandIcon";
import { Plus, Calendar, TrendingUp, ArrowLeft, BarChart3, Users, Target, Zap, CheckCircle2, Clock, Circle } from "lucide-react";
import { useState } from "react";
import { PagePad } from "@/components/layout/PagePad";

/* ─── Campaign data ──────────────────────────────────────────────────────── */
const campaigns = [
  {
    id: "q2-brand-launch",
    name: "Q2 Brand Launch — Video Series",
    type: "Video",
    status: "Active",
    progress: 72,
    due: "Apr 15, 2026",
    kpi: "ROAS 8.2×",
    channels: ["YouTube", "Instagram", "LinkedIn"],
    description: "A multi-platform video campaign anchored by a 90-second brand manifesto, supported by 12 short-form clips across Instagram Reels and LinkedIn. Targeted at enterprise decision-makers and brand-aware consumers in the 28–45 segment.",
    metrics: [
      { label: "ROAS",         value: "8.2×",  delta: "+1.4×",  good: true  },
      { label: "View Rate",    value: "34%",   delta: "+6%",    good: true  },
      { label: "CPM",          value: "$4.20", delta: "-$0.80", good: true  },
      { label: "Conversions",  value: "1,240", delta: "+18%",   good: true  },
    ],
    timeline: [
      { label: "Brief & Strategy",       status: "done",    date: "Mar 1"  },
      { label: "Script & Storyboard",    status: "done",    date: "Mar 8"  },
      { label: "Production",             status: "done",    date: "Mar 22" },
      { label: "Post-Production",        status: "done",    date: "Apr 1"  },
      { label: "Platform Distribution",  status: "active",  date: "Apr 5"  },
      { label: "Optimization Phase",     status: "pending", date: "Apr 10" },
      { label: "Final Report",           status: "pending", date: "Apr 15" },
    ],
    owner: "Isaac",
    budget: "$18,400",
    spent: "$13,248",
  },
  {
    id: "spring-email-nurture",
    name: "Spring Email Nurture — Phase 2",
    type: "Email",
    status: "Review",
    progress: 45,
    due: "Apr 3, 2026",
    kpi: "Open Rate 38%",
    channels: ["Email"],
    description: "A 6-email nurture sequence targeting warm leads who engaged with Q1 content but haven't converted. Personalised send cadence using behavioral triggers. Subject line variants A/B tested across 3 audience segments.",
    metrics: [
      { label: "Open Rate",   value: "38%",   delta: "+12%",  good: true  },
      { label: "CTR",         value: "6.2%",  delta: "+1.8%", good: true  },
      { label: "Unsubscribe", value: "0.3%",  delta: "-0.1%", good: true  },
      { label: "Conversions", value: "94",    delta: "+22%",  good: true  },
    ],
    timeline: [
      { label: "Audience Segmentation",  status: "done",    date: "Mar 10" },
      { label: "Copy & Subject Lines",   status: "done",    date: "Mar 18" },
      { label: "Design & Templates",     status: "active",  date: "Mar 25" },
      { label: "Client Review",          status: "active",  date: "Apr 1"  },
      { label: "Send & Monitor",         status: "pending", date: "Apr 3"  },
    ],
    owner: "Mitchell",
    budget: "$3,200",
    spent: "$1,440",
  },
  {
    id: "thought-leadership-blog",
    name: "Thought Leadership Blog Series",
    type: "Content",
    status: "Active",
    progress: 90,
    due: "Mar 31, 2026",
    kpi: "SEO +2,400 visits",
    channels: ["Blog", "LinkedIn"],
    description: "12-article editorial series establishing brand authority in the AI-native marketing space. Each article is 1,200–1,800 words, optimised for primary and secondary keywords, with supporting LinkedIn posts adapted from each piece.",
    metrics: [
      { label: "Organic Traffic", value: "+2,400", delta: "+2,400", good: true  },
      { label: "Avg. Position",   value: "3.2",     delta: "-1.8",  good: true  },
      { label: "Time on Page",    value: "4m 12s",  delta: "+48s",  good: true  },
      { label: "Backlinks",       value: "34",      delta: "+11",   good: true  },
    ],
    timeline: [
      { label: "Editorial Calendar",  status: "done",    date: "Feb 1"  },
      { label: "Articles 1–4",        status: "done",    date: "Feb 15" },
      { label: "Articles 5–8",        status: "done",    date: "Mar 1"  },
      { label: "Articles 9–12",       status: "active",  date: "Mar 20" },
      { label: "SEO Audit",           status: "active",  date: "Mar 28" },
      { label: "Performance Report",  status: "pending", date: "Mar 31" },
    ],
    owner: "Isaac",
    budget: "$6,000",
    spent: "$5,400",
  },
  {
    id: "paid-social-retargeting",
    name: "Paid Social — Retargeting Q2",
    type: "Paid",
    status: "Planning",
    progress: 12,
    due: "Apr 30, 2026",
    kpi: "CPA Target $18",
    channels: ["Meta", "Google"],
    description: "Retargeting campaign aimed at site visitors who did not convert during Q1 paid campaigns. Leveraging first-party pixel data across Meta and Google Display networks. Creative assets adapted from Q1 best-performers.",
    metrics: [
      { label: "CPA (target)",   value: "$18",   delta: "—",     good: true  },
      { label: "Budget",         value: "$12K",  delta: "—",     good: true  },
      { label: "Audience Size",  value: "84K",   delta: "—",     good: true  },
      { label: "Creative Sets",  value: "6",     delta: "—",     good: true  },
    ],
    timeline: [
      { label: "Audience Build",        status: "done",    date: "Apr 1"  },
      { label: "Creative Brief",        status: "active",  date: "Apr 8"  },
      { label: "Ad Build & QA",         status: "pending", date: "Apr 14" },
      { label: "Campaign Launch",       status: "pending", date: "Apr 18" },
      { label: "Week 1 Optimisation",   status: "pending", date: "Apr 25" },
      { label: "Phase 1 Report",        status: "pending", date: "Apr 30" },
    ],
    owner: "Mitchell",
    budget: "$12,000",
    spent: "$0",
  },
];

type Campaign = (typeof campaigns)[0];

/* ─── Helpers ──────────────────────────────────────────────────────────── */
function statusStyle(status: string) {
  if (status === "Active")
    return { color: "#2DD4FF", bg: "rgba(45,212,255,0.06)", border: "rgba(45,212,255,0.16)" };
  if (status === "Review")
    return { color: "var(--text-3)", bg: "var(--surface-3)", border: "var(--border-mid)" };
  return   { color: "var(--text-5)", bg: "var(--surface-2)", border: "var(--border)" };
}

function progressColor(p: number) {
  if (p >= 80) return "#2DD4FF";
  if (p >= 45) return "var(--silver)";
  return "var(--text-6)";
}

/* ─── Campaign row ──────────────────────────────────────────────────────── */
function CampaignRow({
  c,
  index,
  active,
  onClick,
}: {
  c: Campaign;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const sc = statusStyle(c.status);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      className="relative flex items-start gap-6 px-6 sm:px-8 py-6 sm:py-7 cursor-pointer opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${0.1 + index * 0.07}s`,
        animationFillMode: "forwards",
        background: active
          ? "rgba(45,212,255,0.04)"
          : hovered
          ? "var(--hover-fill-cyan)"
          : "transparent",
        transition: "background 0.22s ease",
        borderBottom: index < campaigns.length - 1 ? "1px solid var(--border)" : "none",
        borderLeft: active ? "2px solid rgba(45,212,255,0.6)" : "2px solid transparent",
      }}
    >
      {/* Left cyan accent — hovered */}
      {!active && (
        <div style={{
          position: "absolute",
          left: 0, top: 14, bottom: 14,
          width: 2, borderRadius: 2,
          background: "linear-gradient(180deg, var(--cyan), rgba(45,212,255,0.3))",
          opacity: hovered ? 0.65 : 0,
          transition: "opacity 0.22s ease",
        }} />
      )}

      <div className="flex-1 min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <p
            className="text-[14px] font-medium"
            style={{
              color: active ? "var(--text)" : hovered ? "var(--text-2)" : "var(--text-3)",
              transition: "color 0.2s",
              letterSpacing: "-0.012em",
            }}
          >
            {c.name}
          </p>
          <span
            className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full"
            style={{
              color: sc.color, background: sc.bg,
              border: `1px solid ${sc.border}`,
              letterSpacing: "0.03em",
            }}
          >
            {c.status}
          </span>
        </div>

        {/* Meta */}
        <div
          className="flex items-center gap-4 sm:gap-6 flex-wrap mb-5"
          style={{ fontSize: 11 }}
        >
          <span
            className="flex items-center gap-1.5"
            style={{ color: hovered || active ? "var(--text-5)" : "var(--text-6)", transition: "color 0.2s" }}
          >
            <Calendar style={{ width: 10, height: 10 }} strokeWidth={1.5} />
            {c.due}
          </span>
          <span
            className="flex items-center gap-1.5"
            style={{ color: hovered || active ? "var(--text-4)" : "var(--text-5)", transition: "color 0.2s" }}
          >
            <TrendingUp
              style={{ width: 10, height: 10, color: hovered || active ? "var(--cyan)" : "var(--text-6)", transition: "color 0.2s" }}
              strokeWidth={1.5}
            />
            {c.kpi}
          </span>
          <span
            className="px-2 py-0.5 rounded-[5px]"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              fontSize: 10, letterSpacing: "0.05em",
              color: "var(--text-6)",
            }}
          >
            {c.type}
          </span>
        </div>

        {/* Progress bar */}
        <div>
          <div
            className="rounded-full overflow-hidden"
            style={{ height: 4, background: "var(--surface-3)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${c.progress}%`,
                background: hovered || active
                  ? `linear-gradient(90deg, ${progressColor(c.progress)}, var(--cyan))`
                  : progressColor(c.progress),
                opacity: hovered || active ? 1 : 0.5,
                transition: "width 0.7s ease, opacity 0.25s, background 0.25s",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5" style={{ fontSize: 10 }}>
            <span style={{ color: "var(--text-6)" }}>Progress</span>
            <span style={{ color: hovered || active ? "var(--text-4)" : "var(--text-6)", transition: "color 0.2s" }}>
              {c.progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Channel tags with brand icons */}
      <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
        {c.channels.map((ch) => (
          <span
            key={ch}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 10,
              fontWeight: 500,
              padding: "4px 8px",
              borderRadius: 6,
              color: hovered || active ? "var(--text-3)" : "var(--text-5)",
              background: "var(--surface-2)",
              border: `1px solid ${hovered || active ? "var(--border-mid)" : "var(--border)"}`,
              transition: "color 0.2s, border-color 0.2s",
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            <BrandIcon
              name={ch}
              size={11}
              color={hovered || active ? brandColor(ch) : "var(--text-6)"}
            />
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Timeline item ─────────────────────────────────────────────────────── */
function TimelineItem({
  item,
  isLast,
}: {
  item: Campaign["timeline"][0];
  isLast: boolean;
}) {
  const IconComp =
    item.status === "done" ? CheckCircle2 : item.status === "active" ? Clock : Circle;
  const iconColor =
    item.status === "done" ? "#2DD4FF" : item.status === "active" ? "#F59E0B" : "var(--text-6)";

  return (
    <div style={{ display: "flex", gap: 12, position: "relative" }}>
      {/* Vertical connector */}
      {!isLast && (
        <div style={{
          position: "absolute",
          left: 8, top: 22, bottom: -8,
          width: 1,
          background: item.status === "done"
            ? "rgba(45,212,255,0.25)"
            : "var(--border)",
        }} />
      )}

      <IconComp
        style={{ width: 18, height: 18, color: iconColor, flexShrink: 0, marginTop: 1 }}
        strokeWidth={item.status === "done" ? 2 : 1.5}
      />

      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <p style={{
            fontSize: 12.5, fontWeight: item.status === "active" ? 600 : 400,
            color: item.status === "pending" ? "var(--text-5)" : "var(--text-2)",
          }}>
            {item.label}
          </p>
          <span style={{ fontSize: 10, color: "var(--text-6)" }}>{item.date}</span>
        </div>
        {item.status === "active" && (
          <span style={{
            display: "inline-block", marginTop: 3,
            fontSize: 9, fontWeight: 600, letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: "#F59E0B", background: "rgba(245,158,11,0.08)",
            border: "1px solid rgba(245,158,11,0.18)",
            padding: "1px 7px", borderRadius: 20,
          }}>
            In Progress
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Campaign detail panel ─────────────────────────────────────────────── */
function CampaignDetail({ c, onClose }: { c: Campaign; onClose: () => void }) {
  const sc = statusStyle(c.status);
  const spentPct = Math.round((parseInt(c.spent.replace(/[$,]/g, "")) / parseInt(c.budget.replace(/[$,]/g, ""))) * 100) || 0;

  return (
    <div
      className="opacity-0 animate-fade-in-up"
      style={{
        animationFillMode: "forwards",
        border: "1px solid rgba(45,212,255,0.12)",
        borderRadius: 18,
        background: "var(--surface)",
        boxShadow: "var(--shadow-card-hover)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 28px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(45,212,255,0.015)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.02em" }}>
              {c.name}
            </h3>
            <span
              style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
                padding: "3px 10px", borderRadius: 20,
                color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`,
              }}
            >
              {c.status}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-5)", lineHeight: 1.6, maxWidth: 640 }}>
            {c.description}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 16, color: "var(--text-5)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(45,212,255,0.2)"; e.currentTarget.style.color = "var(--cyan)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-5)"; }}
        >
          <ArrowLeft style={{ width: 13, height: 13 }} strokeWidth={2} />
        </button>
      </div>

      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* Left column: Metrics + Budget */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* KPI cards */}
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 12 }}>
              Key Metrics
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {c.metrics.map((m) => {
                const metricIcons: Record<string, typeof BarChart3> = {
                  "ROAS": TrendingUp, "View Rate": Users, "CPM": Target,
                  "Conversions": Zap, "Open Rate": BarChart3, "CTR": Target,
                  "Unsubscribe": Users, "Organic Traffic": TrendingUp,
                  "Avg. Position": BarChart3, "Time on Page": Clock,
                  "Backlinks": Zap, "CPA (target)": Target,
                  "Budget": BarChart3, "Audience Size": Users, "Creative Sets": Zap,
                };
                const MIcon = metricIcons[m.label] ?? BarChart3;
                return (
                  <div
                    key={m.label}
                    style={{
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <MIcon style={{ width: 13, height: 13, color: "var(--text-5)" }} strokeWidth={1.5} />
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: m.good ? "#2DD4FF" : "#ef4444",
                        background: m.good ? "rgba(45,212,255,0.07)" : "rgba(239,68,68,0.07)",
                        border: `1px solid ${m.good ? "rgba(45,212,255,0.16)" : "rgba(239,68,68,0.16)"}`,
                        padding: "1px 6px", borderRadius: 20,
                      }}>
                        {m.delta}
                      </span>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>
                      {m.value}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--text-5)", marginTop: 4 }}>{m.label}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Budget */}
          <div style={{ padding: "18px 20px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 14 }}>
              Budget
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>{c.spent}</p>
                <p style={{ fontSize: 10, color: "var(--text-5)", marginTop: 3 }}>Spent</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text-4)", letterSpacing: "-0.04em", lineHeight: 1 }}>{c.budget}</p>
                <p style={{ fontSize: 10, color: "var(--text-5)", marginTop: 3 }}>Total Budget</p>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--surface-3)", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${spentPct}%`,
                background: spentPct > 90
                  ? "linear-gradient(90deg, #ef4444, #dc2626)"
                  : "linear-gradient(90deg, rgba(45,212,255,0.6), #2DD4FF)",
                borderRadius: 3,
                transition: "width 0.8s ease",
              }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--text-6)" }}>
              <span>{spentPct}% used</span>
              <span>Owner: {c.owner}</span>
            </div>
          </div>
        </div>

        {/* Right column: Timeline */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 16 }}>
            Timeline
          </p>
          <div style={{ padding: "4px 0" }}>
            {c.timeline.map((t, i) => (
              <TimelineItem key={i} item={t} isLast={i === c.timeline.length - 1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Summary card ──────────────────────────────────────────────────────── */
function SummaryCard({ label, value, accent }: { label: string; value: string; accent: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative px-5 sm:px-6 py-5 sm:py-6 rounded-[16px] text-center overflow-hidden"
      style={{
        background: hovered
          ? accent ? "rgba(45,212,255,0.05)" : "var(--hover-fill-cyan)"
          : "var(--surface)",
        border: `1px solid ${hovered
          ? accent ? "rgba(45,212,255,0.20)" : "var(--border-mid)"
          : "var(--border)"}`,
        boxShadow: hovered ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        transition: "background 0.22s, border-color 0.22s, box-shadow 0.22s",
        cursor: "default",
      }}
    >
      {accent && (
        <div style={{
          position: "absolute",
          top: 0, left: "25%", right: "25%",
          height: 1,
          background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.45), transparent)",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.22s",
        }} />
      )}
      <div
        style={{
          fontSize: "clamp(28px, 5vw, 36px)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: accent && hovered ? "var(--cyan)" : "var(--text)",
          transition: "color 0.22s",
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </div>
      <div className="text-[11px] mt-2" style={{ color: "var(--text-5)" }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */
export default function CampaignsPage() {
  const [selected, setSelected] = useState<Campaign | null>(null);

  const handleSelect = (c: Campaign) => {
    setSelected((prev) => (prev?.id === c.id ? null : c));
  };

  return (
    <PagePad>
    <div
      className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up"
      style={{ animationFillMode: "forwards" }}
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="label-eyebrow mb-2.5">Active Work</p>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 32px)",
              fontWeight: 700,
              letterSpacing: "-0.035em",
              color: "var(--text)",
              lineHeight: 1,
            }}
          >
            Campaigns
          </h2>
        </div>
        <Button variant="primary" size="sm">
          <Plus className="h-3.5 w-3.5" />
          New Brief
        </Button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryCard label="Active"    value="2" accent={true}  />
        <SummaryCard label="In Review" value="1" accent={false} />
        <SummaryCard label="Planning"  value="1" accent={false} />
      </div>

      {/* Campaign list */}
      <div
        className="rounded-[18px] overflow-hidden"
        style={{
          border: "1px solid var(--border)",
          background: "var(--surface)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {/* List header */}
        <div
          className="px-6 sm:px-8 py-4 sm:py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="section-label">All Campaigns</span>
          <span style={{ fontSize: 11, color: "var(--text-6)" }}>
            {selected ? (
              <span style={{ color: "var(--cyan)" }}>
                {selected.name.split(" — ")[0]} selected — click to collapse
              </span>
            ) : (
              `${campaigns.length} total · click any row to expand`
            )}
          </span>
        </div>

        {campaigns.map((c, i) => (
          <CampaignRow
            key={i}
            c={c}
            index={i}
            active={selected?.id === c.id}
            onClick={() => handleSelect(c)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selected && (
        <CampaignDetail c={selected} onClose={() => setSelected(null)} />
      )}
    </div>
    </PagePad>
  );
}
