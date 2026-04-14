"use client";

/**
 * ThinkingDots
 *
 * 9-dot 3×3 matrix loading animation — replaces ThinkingHex.
 * A soft light wave sweeps diagonally across the dots, creating
 * a flowing "intelligence processing" feel.
 *
 * Usage:
 *   <ThinkingDots />
 *   <ThinkingDots size={6} label="Thinking…" inline />
 */

import { useEffect, useRef } from "react";

interface ThinkingDotsProps {
  size?: number;      // dot diameter in px (default 5)
  gap?: number;       // gap between dots in px (default 4)
  label?: string;
  inline?: boolean;
}

// Wave sweeps diagonally top-left → bottom-right
// Each dot has a delay = (row + col) * stepMs
const STEP_MS  = 120;   // delay per diagonal step
const CYCLE_MS = 1100;  // total wave period

export function ThinkingDots({ size = 5, gap = 4, label, inline = false }: ThinkingDotsProps) {
  const dotsRef = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef  = useRef<number>(0);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const dots = dotsRef.current;

    const frame = (now: number) => {
      const elapsed = now - startRef.current;

      dots.forEach((dot, i) => {
        if (!dot) return;
        const row = Math.floor(i / 3);
        const col = i % 3;

        // Each dot's wave position — offset by its diagonal distance
        const delay   = (row + col) * STEP_MS;
        const phase   = ((elapsed - delay) % CYCLE_MS + CYCLE_MS) % CYCLE_MS;
        // Sine wave: peak at phase ≈ 0, fade out toward CYCLE_MS
        // Map phase [0, CYCLE_MS] → [0, 2π] → brightness
        const t        = phase / CYCLE_MS;
        // Sharp gaussian-like pulse: exp(-((t - 0)^2 * k))
        // We use a shifted cosine for smooth rise/fall
        const angle    = t * Math.PI * 2;
        const bright   = Math.max(0, Math.cos(angle)); // 1 at peak, -1 at trough → clamp to 0

        // Map brightness [0,1] to opacity [0.10, 0.95]
        const opacity  = 0.10 + bright * 0.85;
        // Scale: peak = 1.35, trough = 0.70
        const scale    = 0.70 + bright * 0.65;

        dot.style.opacity   = opacity.toFixed(3);
        dot.style.transform = `scale(${scale.toFixed(3)})`;
      });

      rafRef.current = requestAnimationFrame(frame);
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const gridSize = size * 3 + gap * 2;

  const grid = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(3, ${size}px)`,
        gridTemplateRows:    `repeat(3, ${size}px)`,
        gap: `${gap}px`,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <div
          key={i}
          ref={(el) => { dotsRef.current[i] = el; }}
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--cyan)",
            opacity: 0.15,
            willChange: "opacity, transform",
            // Glow on the center dot (index 4) is always slightly brighter
            boxShadow: i === 4
              ? `0 0 ${size * 1.4}px rgba(45,212,255,0.45)`
              : "none",
          }}
        />
      ))}
    </div>
  );

  if (!label) return grid;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: inline ? 8 : 6,
      flexDirection: inline ? "row" : "column",
    }}>
      {grid}
      <span style={{
        fontSize: inline ? 11 : 9.5,
        color: "var(--cyan)",
        letterSpacing: inline ? "0.01em" : "0.09em",
        textTransform: inline ? "none" : "uppercase",
        opacity: 0.82,
        fontWeight: inline ? 500 : 600,
        lineHeight: 1,
      }}>
        {label}
      </span>
    </div>
  );
}
