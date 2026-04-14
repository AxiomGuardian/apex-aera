"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText, Video, Image, Mail } from "lucide-react";
import { PagePad } from "@/components/layout/PagePad";

const deliverables = [
  { name: "Q1 Brand Report — Full PDF",       type: "PDF",    date: "Mar 15, 2026", size: "4.2 MB",  icon: FileText },
  { name: "Instagram Carousel Pack × 8",      type: "Design", date: "Mar 12, 2026", size: "18.7 MB", icon: Image    },
  { name: "YouTube Brand Video — Final",       type: "Video",  date: "Mar 8, 2026",  size: "412 MB",  icon: Video    },
  { name: "Email Nurture Sequence — Phase 1",  type: "Copy",   date: "Feb 28, 2026", size: "84 KB",   icon: Mail     },
  { name: "Voice & Tone Guide 2026",           type: "PDF",    date: "Feb 14, 2026", size: "2.1 MB",  icon: FileText },
  { name: "LinkedIn Thought Leadership × 12",  type: "Copy",   date: "Feb 5, 2026",  size: "156 KB",  icon: FileText },
];

const typeStyle: Record<string, { color: string; bg: string; border: string }> = {
  PDF:    { color: "var(--text-4)",  bg: "var(--surface-2)",      border: "var(--border)"          },
  Design: { color: "var(--cyan)",    bg: "rgba(45,212,255,0.07)", border: "rgba(45,212,255,0.16)"  },
  Video:  { color: "var(--silver)",  bg: "var(--surface-3)",      border: "var(--border-mid)"      },
  Copy:   { color: "var(--text-4)",  bg: "var(--surface-2)",      border: "var(--border)"          },
};

function StatCard({ label, value }: { label: string; value: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "22px 22px 20px",
        borderRadius: 16,
        background: hovered ? "var(--hover-fill-cyan)" : "var(--surface)",
        border: `1px solid ${hovered ? "var(--border-mid)" : "var(--border)"}`,
        boxShadow: hovered ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        transition: "background 0.22s, border-color 0.22s, box-shadow 0.22s",
        cursor: "default",
        position: "relative" as const,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: "clamp(26px, 4vw, 34px)",
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          color: "var(--text)",
          fontFeatureSettings: '"tnum"',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--text-6)", marginTop: 7, letterSpacing: "0.01em" }}>
        {label}
      </div>
      {/* subtle top hairline on hover */}
      <div style={{
        position: "absolute",
        top: 0, left: "20%", right: "20%",
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.28), transparent)",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.22s",
      }} />
    </div>
  );
}

function DeliverableRow({
  d, index, isLast,
}: {
  d: typeof deliverables[0];
  index: number;
  isLast: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const Icon = d.icon;
  const ts = typeStyle[d.type] ?? typeStyle.PDF;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex items-center gap-4 sm:gap-5 px-5 sm:px-7 py-5 sm:py-[22px] opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${0.06 + index * 0.06}s`,
        animationFillMode: "forwards",
        background: hovered ? "var(--hover-fill-cyan)" : "transparent",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        transition: "background 0.22s",
        cursor: "default",
      }}
    >
      {/* Left accent — gradient fade */}
      <div style={{
        position: "absolute",
        left: 0, top: 12, bottom: 12,
        width: 2, borderRadius: 2,
        background: "linear-gradient(180deg, var(--cyan), rgba(45,212,255,0.25))",
        opacity: hovered ? 0.6 : 0,
        transition: "opacity 0.22s",
      }} />

      {/* File icon badge */}
      <div style={{
        width: 40, height: 40,
        borderRadius: 11,
        background: hovered ? "rgba(45,212,255,0.05)" : "var(--surface-2)",
        border: `1px solid ${hovered ? "rgba(45,212,255,0.12)" : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        transition: "background 0.22s, border-color 0.22s",
      }}>
        <Icon
          style={{
            width: 15, height: 15,
            color: hovered ? "var(--text-4)" : "var(--text-6)",
            transition: "color 0.22s",
          }}
          strokeWidth={1.5}
        />
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13.5,
          fontWeight: 400,
          letterSpacing: "-0.012em",
          color: hovered ? "var(--text-2)" : "var(--text-3)",
          transition: "color 0.2s",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}>
          {d.name}
        </p>
        <p style={{
          fontSize: 11,
          marginTop: 4,
          color: hovered ? "var(--text-6)" : "var(--text-6)",
          letterSpacing: "0.01em",
        }}>
          {d.date}&nbsp;&nbsp;·&nbsp;&nbsp;{d.size}
        </p>
      </div>

      {/* Type badge */}
      <span
        className="hidden sm:inline-flex"
        style={{
          fontSize: 10, fontWeight: 600,
          letterSpacing: "0.05em",
          padding: "4px 10px",
          borderRadius: 20,
          color: ts.color, background: ts.bg,
          border: `1px solid ${ts.border}`,
          flexShrink: 0,
          transition: "opacity 0.2s",
        }}
      >
        {d.type}
      </span>

      {/* Action buttons — appear on hover */}
      <div style={{
        display: "flex", gap: 4, flexShrink: 0,
        opacity: hovered ? 1 : 0,
        transform: hovered ? "translateX(0)" : "translateX(10px)",
        transition: "opacity 0.2s, transform 0.2s",
      }}>
        <ActionBtn icon={<Eye style={{ width: 12, height: 12, color: "var(--text-4)" }} strokeWidth={1.6} />} />
        <ActionBtn
          icon={<Download style={{ width: 12, height: 12, color: "var(--text-4)" }} strokeWidth={1.7} />}
          cyanHover
        />
      </div>
    </div>
  );
}

function ActionBtn({ icon, cyanHover }: { icon: React.ReactNode; cyanHover?: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: hovered
          ? cyanHover ? "rgba(45,212,255,0.09)" : "var(--surface-3)"
          : "var(--surface-2)",
        border: `1px solid ${hovered
          ? cyanHover ? "rgba(45,212,255,0.22)" : "var(--border-mid)"
          : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {icon}
    </button>
  );
}

export default function HistoryPage() {
  return (
    <PagePad>
    <div
      className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up"
      style={{ animationFillMode: "forwards" }}
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <p className="label-eyebrow mb-2.5">History</p>
          <h2
            style={{
              fontSize: "clamp(26px, 4vw, 32px)",
              fontWeight: 700,
              letterSpacing: "-0.04em",
              color: "var(--text)",
              lineHeight: 1,
            }}
          >
            Deliverables
          </h2>
        </div>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5" />
          Download All
        </Button>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total Files" value={`${deliverables.length}`} />
        <StatCard label="This Month"  value="3" />
        <StatCard label="Total Size"  value="437 MB" />
      </div>

      {/* File list */}
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
          className="px-5 sm:px-7 py-4 sm:py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="section-label">All Files</span>
          <span style={{ fontSize: 11, color: "var(--text-6)" }}>
            {deliverables.length} deliverables
          </span>
        </div>

        {deliverables.map((d, i) => (
          <DeliverableRow
            key={i}
            d={d}
            index={i}
            isLast={i === deliverables.length - 1}
          />
        ))}
      </div>
    </div>
    </PagePad>
  );
}
