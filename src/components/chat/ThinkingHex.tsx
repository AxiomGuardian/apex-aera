"use client";

/**
 * ThinkingHex
 *
 * Premium hexagon loading indicator for when AERA is processing.
 * A rotating scanner stroke sweeps around the hexagon continuously,
 * with a soft inner glow and pulsing center dot — quiet, precise, premium.
 *
 * Usage:
 *   <ThinkingHex size={20} />
 *   <ThinkingHex size={28} label="Processing…" />
 */

import { motion } from "framer-motion";

// Flat-top hexagon vertices (radius=11, center=14, viewBox=28×28)
// Orientation: pointy-top (vertex at top)
const R = 11;
const CX = 14;
const CY = 14;
const HEX_POINTS = Array.from({ length: 6 }, (_, i) => {
  const angle = (Math.PI / 3) * i - Math.PI / 2; // start at top
  return `${(CX + R * Math.cos(angle)).toFixed(3)},${(CY + R * Math.sin(angle)).toFixed(3)}`;
}).join(" ");

// Approximate perimeter of regular hexagon: 6 × side = 6 × R
const HEX_PERIMETER = 6 * R; // 66

interface ThinkingHexProps {
  size?: number;
  label?: string;
  /** Show a row layout: hex icon + label text side by side */
  inline?: boolean;
}

export function ThinkingHex({ size = 22, label, inline = false }: ThinkingHexProps) {
  const hex = (
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, width: size, height: size }}>
      <svg
        viewBox="0 0 28 28"
        width={size}
        height={size}
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        {/* Outer glow — very subtle radial behind the hex */}
        <circle cx="14" cy="14" r="16" fill="rgba(45,212,255,0.04)" />

        {/* Static background hexagon — barely visible fill */}
        <polygon
          points={HEX_POINTS}
          fill="rgba(45,212,255,0.055)"
          stroke="rgba(45,212,255,0.18)"
          strokeWidth={0.8}
        />

        {/* Animated scanning stroke — sweeps clockwise */}
        <motion.polygon
          points={HEX_POINTS}
          fill="none"
          stroke="rgba(45,212,255,0.85)"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${HEX_PERIMETER * 0.35} ${HEX_PERIMETER * 0.65}`}
          animate={{ strokeDashoffset: [HEX_PERIMETER, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />

        {/* Inner ghost trail — opposite direction, dimmer */}
        <motion.polygon
          points={HEX_POINTS}
          fill="none"
          stroke="rgba(45,212,255,0.22)"
          strokeWidth={0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={`${HEX_PERIMETER * 0.18} ${HEX_PERIMETER * 0.82}`}
          animate={{ strokeDashoffset: [0, HEX_PERIMETER] }}
          transition={{ duration: 1.9, repeat: Infinity, ease: "linear" }}
        />

        {/* Center dot — gentle pulse */}
        <motion.circle
          cx="14"
          cy="14"
          r="1.8"
          fill="rgba(45,212,255,0.75)"
          animate={{ opacity: [0.35, 1, 0.35], r: [1.4, 2.1, 1.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    </div>
  );

  if (!label) return hex;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: inline ? 7 : 6, flexDirection: inline ? "row" : "column" }}>
      {hex}
      {label && (
        <span style={{
          fontSize: inline ? 11 : 9.5,
          color: "var(--cyan)",
          letterSpacing: inline ? "0.01em" : "0.09em",
          textTransform: inline ? "none" : "uppercase",
          opacity: 0.85,
          fontWeight: inline ? 500 : 600,
          lineHeight: 1,
        }}>
          {label}
        </span>
      )}
    </div>
  );
}
