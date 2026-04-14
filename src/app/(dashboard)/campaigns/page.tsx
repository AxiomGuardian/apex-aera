"use client";

import { Button } from "@/components/ui/button";
import { Plus, Calendar, TrendingUp } from "lucide-react";
import { useState } from "react";
import { PagePad } from "@/components/layout/PagePad";

const campaigns = [
  {
    name: "Q2 Brand Launch — Video Series",
    type: "Video",
    status: "Active",
    progress: 72,
    due: "Apr 15, 2026",
    kpi: "ROAS 8.2×",
    channels: ["YouTube", "Instagram", "LinkedIn"],
  },
  {
    name: "Spring Email Nurture — Phase 2",
    type: "Email",
    status: "Review",
    progress: 45,
    due: "Apr 3, 2026",
    kpi: "Open Rate 38%",
    channels: ["Email"],
  },
  {
    name: "Thought Leadership Blog Series",
    type: "Content",
    status: "Active",
    progress: 90,
    due: "Mar 31, 2026",
    kpi: "SEO +2,400 visits",
    channels: ["Blog", "LinkedIn"],
  },
  {
    name: "Paid Social — Retargeting Q2",
    type: "Paid",
    status: "Planning",
    progress: 12,
    due: "Apr 30, 2026",
    kpi: "CPA Target $18",
    channels: ["Meta", "Google"],
  },
];

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

function CampaignRow({ c, index }: { c: typeof campaigns[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const sc = statusStyle(c.status);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-start gap-6 px-6 sm:px-8 py-6 sm:py-7 cursor-default opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${0.1 + index * 0.07}s`,
        animationFillMode: "forwards",
        background: hovered ? "var(--hover-fill-cyan)" : "transparent",
        transition: "background 0.22s ease",
        borderBottom: index < campaigns.length - 1 ? "1px solid var(--border)" : "none",
      }}
    >
      {/* Left cyan accent */}
      <div style={{
        position: "absolute",
        left: 0, top: 14, bottom: 14,
        width: 2, borderRadius: 2,
        background: "linear-gradient(180deg, var(--cyan), rgba(45,212,255,0.3))",
        opacity: hovered ? 0.65 : 0,
        transition: "opacity 0.22s ease",
      }} />

      <div className="flex-1 min-w-0">
        {/* Name + status */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <p
            className="text-[14px] font-medium"
            style={{
              color: hovered ? "var(--text-2)" : "var(--text-3)",
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
            style={{ color: hovered ? "var(--text-5)" : "var(--text-6)", transition: "color 0.2s" }}
          >
            <Calendar style={{ width: 10, height: 10 }} strokeWidth={1.5} />
            {c.due}
          </span>
          <span
            className="flex items-center gap-1.5"
            style={{ color: hovered ? "var(--text-4)" : "var(--text-5)", transition: "color 0.2s" }}
          >
            <TrendingUp
              style={{ width: 10, height: 10, color: hovered ? "var(--cyan)" : "var(--text-6)", transition: "color 0.2s" }}
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
                background: hovered
                  ? `linear-gradient(90deg, ${progressColor(c.progress)}, var(--cyan))`
                  : progressColor(c.progress),
                opacity: hovered ? 1 : 0.5,
                transition: "width 0.7s ease, opacity 0.25s, background 0.25s",
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5" style={{ fontSize: 10 }}>
            <span style={{ color: "var(--text-6)" }}>Progress</span>
            <span style={{ color: hovered ? "var(--text-4)" : "var(--text-6)", transition: "color 0.2s" }}>
              {c.progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Channel tags */}
      <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
        {c.channels.map((ch) => (
          <span
            key={ch}
            className="text-[10px] font-medium px-2.5 py-1 rounded-[6px]"
            style={{
              color: hovered ? "var(--text-4)" : "var(--text-6)",
              background: "var(--surface-2)",
              border: `1px solid ${hovered ? "var(--border-mid)" : "var(--border)"}`,
              transition: "color 0.2s, border-color 0.2s",
              letterSpacing: "0.03em",
            }}
          >
            {ch}
          </span>
        ))}
      </div>
    </div>
  );
}

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
      {/* Top cyan accent */}
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

export default function CampaignsPage() {
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
            {campaigns.length} total
          </span>
        </div>

        {campaigns.map((c, i) => (
          <CampaignRow key={i} c={c} index={i} />
        ))}
      </div>
    </div>
    </PagePad>
  );
}
