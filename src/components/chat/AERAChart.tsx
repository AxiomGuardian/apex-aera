"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChartData } from "@/context/AERAContext";
import {
  BarChart, Bar, Cell, LabelList,
  LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PieChart, Pie, Cell as PieCell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── APEX base palette ──────────────────────────────────────────────
const CYAN      = "#2DD4FF";
const SURFACE   = "#111113";
const BORDER    = "rgba(45,212,255,0.16)";
const TEXT_DIM  = "rgba(255,255,255,0.40)";
const TEXT_MID  = "rgba(255,255,255,0.65)";

// ── Platform brand identity ────────────────────────────────────────
// Provides color + a short letter/glyph for the icon badge in axis ticks.
interface PlatformDef { color: string; letter: string; glow: string }

const PLATFORM_MAP: Record<string, PlatformDef> = {
  meta:     { color: "#1877F2", letter: "f",  glow: "rgba(24,119,242,0.40)"  },
  facebook: { color: "#1877F2", letter: "f",  glow: "rgba(24,119,242,0.40)"  },
  google:   { color: "#4285F4", letter: "G",  glow: "rgba(66,133,244,0.40)"  },
  tiktok:   { color: "#69C9D0", letter: "T",  glow: "rgba(105,201,208,0.40)" },
  email:    { color: "#F59E0B", letter: "✉",  glow: "rgba(245,158,11,0.40)"  },
  nurture:  { color: "#F59E0B", letter: "✉",  glow: "rgba(245,158,11,0.40)"  },
  seo:      { color: "#22C55E", letter: "◎",  glow: "rgba(34,197,94,0.40)"   },
  organic:  { color: "#22C55E", letter: "◎",  glow: "rgba(34,197,94,0.40)"   },
  linkedin: { color: "#0A66C2", letter: "in", glow: "rgba(10,102,194,0.40)"  },
  youtube:  { color: "#FF4444", letter: "▶",  glow: "rgba(255,68,68,0.40)"   },
  twitter:  { color: "#1DA1F2", letter: "𝕏",  glow: "rgba(29,161,242,0.40)"  },
  paid:     { color: "#818CF8", letter: "⬡",  glow: "rgba(129,140,248,0.40)" },
  social:   { color: "#F472B6", letter: "◈",  glow: "rgba(244,114,182,0.40)" },
  search:   { color: "#4285F4", letter: "⌕",  glow: "rgba(66,133,244,0.40)"  },
  brand:    { color: CYAN,      letter: "◆",  glow: "rgba(45,212,255,0.40)"  },
};

// Pie / radar multi-series colours — rich, not all-cyan
const MULTI_COLORS = [CYAN, "#818CF8", "#34D399", "#FB923C", "#F472B6", "#FACC15", "#60A5FA", "#A78BFA"];

function detectPlatform(label: string): PlatformDef | null {
  const lower = label.toLowerCase();
  for (const [key, val] of Object.entries(PLATFORM_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

// ── Custom XAxis tick — icon badge + label ─────────────────────────
// Renders inside SVG so we use primitive SVG elements.
function PlatformTick(props: Record<string, unknown>) {
  const x      = props.x as number;
  const y      = props.y as number;
  const payload = props.payload as { value: string };
  const platform = detectPlatform(payload.value);

  // Shorten long labels so they don't overflow
  const raw   = payload.value;
  const label = raw.length > 11 ? raw.slice(0, 10) + "…" : raw;

  if (platform) {
    return (
      <g transform={`translate(${x},${y + 4})`}>
        {/* Glow ring */}
        <circle cx={0} cy={2} r={12} fill={platform.glow} />
        {/* Brand colour circle */}
        <circle cx={0} cy={2} r={10} fill={platform.color} opacity={0.92} />
        {/* Letter */}
        <text x={0} y={6.5} textAnchor="middle" fontSize={9.5} fill="#ffffff" fontWeight={700}>
          {platform.letter}
        </text>
        {/* Label below */}
        <text x={0} y={26} textAnchor="middle" fontSize={10} fill={TEXT_DIM}>
          {label}
        </text>
      </g>
    );
  }

  return (
    <g transform={`translate(${x},${y + 4})`}>
      <text x={0} y={12} textAnchor="middle" fontSize={10} fill={TEXT_DIM}>
        {label}
      </text>
    </g>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────
function ApexTooltip({
  active, payload, label, unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  const platform = label ? detectPlatform(label) : null;
  const accentColor = platform ? platform.color : CYAN;

  return (
    <div style={{
      background: "#18181b",
      border: `1px solid ${accentColor}55`,
      borderRadius: 9,
      padding: "9px 14px",
      fontSize: 12,
      color: "#fff",
      boxShadow: `0 4px 24px rgba(0,0,0,0.65), 0 0 14px ${accentColor}22`,
    }}>
      {label && <div style={{ color: TEXT_DIM, marginBottom: 4, fontSize: 11 }}>{label}</div>}
      <div style={{ color: accentColor, fontWeight: 700, fontSize: 14 }}>
        {payload[0].value}{unit ?? ""}
      </div>
    </div>
  );
}

// ── Pie label ──────────────────────────────────────────────────────
interface PieLabelProps {
  cx?: number; cy?: number; midAngle?: number;
  innerRadius?: number; outerRadius?: number;
  percent?: number; name?: string;
}
function PieLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0, name = "" }: PieLabelProps) {
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5 + 22;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.04) return null; // skip tiny slices
  return (
    <text x={x} y={y} fill={TEXT_MID} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" fontSize={10.5}>
      {name} {(percent * 100).toFixed(0)}%
    </text>
  );
}

// ── Chart type badge ───────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  bar: "BAR",
  line: "TREND",
  radar: "RADAR",
  pie: "MIX",
};

// ── Main export ────────────────────────────────────────────────────
export default function AERAChart({ chart }: { chart: ChartData }) {
  const { type, title, labels, data, unit } = chart;

  // ── Visibility-gated animation ────────────────────────────────
  // IntersectionObserver fires `ready` only when the chart is actually
  // on-screen. This ensures the grow/draw animation plays the moment
  // the user's eyes land on it — even if the component mounted while
  // they were in voice mode and not looking at the chat panel.
  const cardRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const chartData = labels.map((label, i) => ({ name: label, value: data[i] ?? 0 }));

  const commonAxisProps = {
    axisLine: { stroke: "rgba(255,255,255,0.07)" },
    tickLine: false,
  };

  // ── Render per chart type ──────────────────────────────────────
  const renderChart = () => {
    switch (type) {

      case "bar": {
        const hasPlatforms = chartData.some(d => detectPlatform(d.name) !== null);
        return (
          <BarChart data={chartData} barSize={hasPlatforms ? 26 : 30} barGap={6}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="name"
              {...commonAxisProps}
              tick={hasPlatforms ? (props) => <PlatformTick {...(props as Record<string, unknown>)} /> : { fill: TEXT_DIM, fontSize: 11 }}
              height={hasPlatforms ? 52 : 24}
            />
            <YAxis
              {...commonAxisProps}
              tick={{ fill: TEXT_DIM, fontSize: 10 }}
              tickFormatter={(v: number) => `${v}${unit ?? ""}`}
              width={40}
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.18)]}
            />
            <Tooltip content={<ApexTooltip unit={unit} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar
              dataKey="value"
              radius={[5, 5, 0, 0]}
              isAnimationActive={ready}
              animationBegin={0}
              animationDuration={1800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, i) => {
                const p = detectPlatform(entry.name);
                return (
                  <Cell
                    key={i}
                    fill={p ? p.color : CYAN}
                    opacity={0.88}
                  />
                );
              })}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v) => `${v}${unit ?? ""}`}
                style={{ fill: TEXT_MID, fontSize: 10.5, fontWeight: 600 }}
              />
            </Bar>
          </BarChart>
        );
      }

      case "line":
        return (
          <LineChart data={chartData}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
            <XAxis
              dataKey="name"
              {...commonAxisProps}
              tick={{ fill: TEXT_DIM, fontSize: 10 }}
            />
            <YAxis
              {...commonAxisProps}
              tick={{ fill: TEXT_DIM, fontSize: 10 }}
              tickFormatter={(v: number) => `${v}${unit ?? ""}`}
              width={40}
              domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
            />
            <Tooltip content={<ApexTooltip unit={unit} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={CYAN}
              strokeWidth={2.5}
              dot={{ fill: CYAN, r: 4.5, strokeWidth: 0 }}
              activeDot={{ r: 7, fill: CYAN, stroke: "#0d0d0f", strokeWidth: 2.5 }}
              isAnimationActive={ready}
              animationBegin={0}
              animationDuration={2500}
              animationEasing="ease-in-out"
            >
              <LabelList
                dataKey="value"
                position="top"
                formatter={(v) => `${v}${unit ?? ""}`}
                style={{ fill: "rgba(45,212,255,0.7)", fontSize: 9.5, fontWeight: 600 }}
              />
            </Line>
          </LineChart>
        );

      case "radar":
        return (
          <RadarChart data={chartData} outerRadius={88}>
            <PolarGrid stroke="rgba(255,255,255,0.07)" />
            <PolarAngleAxis dataKey="name" tick={{ fill: TEXT_MID, fontSize: 10.5 }} />
            <Radar
              dataKey="value"
              stroke={CYAN}
              fill={CYAN}
              fillOpacity={0.16}
              strokeWidth={2}
              isAnimationActive={ready}
              animationBegin={0}
              animationDuration={1800}
              animationEasing="ease-out"
            />
            <Tooltip content={<ApexTooltip unit={unit} />} />
          </RadarChart>
        );

      case "pie":
        return (
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={92}
              innerRadius={46}
              strokeWidth={0}
              labelLine={false}
              label={(props) => <PieLabel {...props} />}
              isAnimationActive={ready}
              animationBegin={0}
              animationDuration={1800}
              animationEasing="ease-out"
            >
              {chartData.map((entry, i) => {
                const p = detectPlatform(entry.name);
                return (
                  <PieCell
                    key={i}
                    fill={p ? p.color : MULTI_COLORS[i % MULTI_COLORS.length]}
                    opacity={0.9}
                  />
                );
              })}
            </Pie>
            <Tooltip content={<ApexTooltip unit={unit} />} />
          </PieChart>
        );

      default:
        return null;
    }
  };

  const rendered = renderChart();
  if (!rendered) return null;

  const isPieOrRadar = type === "pie" || type === "radar";

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 22, scale: 0.97 }}
      animate={ready ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 22, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 220, damping: 28, duration: 0.6 }}
      style={{
        marginTop: 10,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: "16px 12px 12px",
        boxShadow: [
          "0 0 0 1px rgba(0,0,0,0.5)",
          "0 8px 32px rgba(0,0,0,0.55)",
          "inset 0 1px 0 rgba(45,212,255,0.07)",
        ].join(", "),
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Subtle ambient glow in top-left */}
      <div style={{
        position: "absolute", top: 0, left: 0,
        width: 120, height: 80,
        background: "radial-gradient(ellipse at 0% 0%, rgba(45,212,255,0.07) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingLeft: 4, paddingRight: 4 }}>
        <span style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: CYAN,
          opacity: 0.80,
        }}>
          {title}
        </span>
        <span style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(45,212,255,0.35)",
          background: "rgba(45,212,255,0.06)",
          border: "1px solid rgba(45,212,255,0.12)",
          borderRadius: 5,
          padding: "2px 7px",
        }}>
          {TYPE_LABELS[type] ?? type.toUpperCase()}
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={isPieOrRadar ? 230 : 195}>
        {rendered}
      </ResponsiveContainer>
    </motion.div>
  );
}
