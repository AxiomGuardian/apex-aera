"use client";

/**
 * AERAAvatar — Animated identity mark for AERA messages.
 *
 * Three-layer system:
 *  1. Outer rotating conic-gradient ring (speed reflects state)
 *  2. Inner glass circle with ApexMark
 *  3. Expanding pulse ring when active (typing / speaking)
 *
 * CSS classes live in globals.css under "AERA Avatar".
 */

import { ApexMark } from "./ApexMark";

export type AERAState = "idle" | "typing" | "speaking" | "listening";

interface Props {
  state?: AERAState;
  size?: number; // outer diameter in px (default 38)
}

const RING_SPEED: Record<AERAState, string> = {
  idle:      "5s",
  listening: "3s",
  typing:    "2s",
  speaking:  "1.2s",
};

const RING_OPACITY: Record<AERAState, number> = {
  idle:      0.35,
  listening: 0.50,
  typing:    0.55,
  speaking:  0.65,
};

const INNER_BG: Record<AERAState, string> = {
  idle:      "rgba(255,255,255,0.03)",
  listening: "rgba(45,212,255,0.05)",
  typing:    "rgba(45,212,255,0.07)",
  speaking:  "rgba(45,212,255,0.10)",
};

export function AERAAvatar({ state = "idle", size = 38 }: Props) {
  const markSize = Math.round(size * 0.37);
  const innerInset = Math.round(size * 0.08);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* ── Outer rotating conic ring ── */}
      <div
        className="aera-avatar-ring"
        style={{
          animationDuration: RING_SPEED[state],
          opacity: RING_OPACITY[state],
          transition: "opacity 0.6s ease, animation-duration 0.4s",
        }}
      />

      {/* ── Inner glass circle ── */}
      <div
        style={{
          position: "absolute",
          inset: innerInset,
          borderRadius: "50%",
          background: INNER_BG[state],
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 0.4s ease",
          backdropFilter: "blur(8px)",
        }}
      >
        <ApexMark size={markSize} glow={state !== "idle"} />
      </div>

      {/* ── Expanding pulse ring (active states only) ── */}
      {(state === "typing" || state === "speaking" || state === "listening") && (
        <div
          className="aera-avatar-pulse"
          style={{
            animationDuration: state === "speaking" ? "1.4s" : "2.2s",
          }}
        />
      )}
    </div>
  );
}
