/**
 * BrandIcon — maps a platform/channel name to its official brand icon.
 * Uses react-icons/si (Simple Icons) for most logos, with inline SVG
 * fallbacks for brands not available in this version.
 */

import {
  SiYoutube,
  SiInstagram,
  SiMeta,
  SiGoogle,
  SiGmail,
  SiTiktok,
  SiX,
  SiSlack,
  SiCalendly,
  SiNotion,
} from "react-icons/si";
import {
  Globe,
  Mail,
  FileText,
  Megaphone,
} from "lucide-react";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";

/* ─── LinkedIn inline SVG (not in this si version) ────────────────────── */
function LinkedInIcon({ size, color }: { size: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color ?? "#0A66C2"}
      style={{ flexShrink: 0 }}
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

/* ─── Registry ──────────────────────────────────────────────────────────── */
type SiBrand   = { kind: "si";      Icon: IconType;                             color: string };
type CustomSVG = { kind: "custom";  Icon: React.ComponentType<{ size: number; color?: string }>; color: string };
type LucideBrand = { kind: "lucide"; Icon: LucideIcon;                          color: string };

type BrandEntry = SiBrand | CustomSVG | LucideBrand;

const registry: Record<string, BrandEntry> = {
  YouTube:   { kind: "si",     Icon: SiYoutube,   color: "#FF0000" },
  Instagram: { kind: "si",     Icon: SiInstagram, color: "#E1306C" },
  LinkedIn:  { kind: "custom", Icon: LinkedInIcon, color: "#0A66C2" },
  Meta:      { kind: "si",     Icon: SiMeta,      color: "#0082FB" },
  Facebook:  { kind: "si",     Icon: SiMeta,      color: "#0082FB" },
  Google:    { kind: "si",     Icon: SiGoogle,    color: "#4285F4" },
  Gmail:     { kind: "si",     Icon: SiGmail,     color: "#EA4335" },
  Email:     { kind: "lucide", Icon: Mail,        color: "#a3a3a3" },
  TikTok:    { kind: "si",     Icon: SiTiktok,    color: "#ffffff" },
  X:         { kind: "si",     Icon: SiX,         color: "#ffffff" },
  Twitter:   { kind: "si",     Icon: SiX,         color: "#ffffff" },
  Slack:     { kind: "si",     Icon: SiSlack,     color: "#4A154B" },
  Calendly:  { kind: "si",     Icon: SiCalendly,  color: "#006BFF" },
  Notion:    { kind: "si",     Icon: SiNotion,    color: "#ffffff" },
  Blog:      { kind: "lucide", Icon: FileText,    color: "#a3a3a3" },
  Website:   { kind: "lucide", Icon: Globe,       color: "#a3a3a3" },
  Ads:       { kind: "lucide", Icon: Megaphone,   color: "#a3a3a3" },
};

/* ─── Component ─────────────────────────────────────────────────────────── */
interface BrandIconProps {
  name: string;
  size?: number;
  /** Override brand's default color, e.g. "var(--text-5)" for muted */
  color?: string;
  className?: string;
}

export function BrandIcon({ name, size = 14, color, className }: BrandIconProps) {
  const entry = registry[name];

  if (!entry) {
    return (
      <Globe
        className={className}
        style={{ width: size, height: size, color: color ?? "#a3a3a3", flexShrink: 0 }}
        strokeWidth={1.5}
      />
    );
  }

  const resolvedColor = color ?? entry.color;

  if (entry.kind === "custom") {
    return <entry.Icon size={size} color={resolvedColor} />;
  }

  if (entry.kind === "si") {
    const Icon = entry.Icon;
    return (
      <Icon
        className={className}
        style={{ width: size, height: size, color: resolvedColor, flexShrink: 0 }}
      />
    );
  }

  // lucide
  const Icon = entry.Icon;
  return (
    <Icon
      className={className}
      style={{ width: size, height: size, color: resolvedColor, flexShrink: 0 }}
      strokeWidth={1.5}
    />
  );
}

/** Returns the brand color for a given platform name */
export function brandColor(name: string): string {
  return registry[name]?.color ?? "#a3a3a3";
}
