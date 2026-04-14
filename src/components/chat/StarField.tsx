"use client";

/**
 * StarField
 *
 * Mario Galaxy-style animated star background for the AERA left panel.
 * Renders a canvas of softly drifting stars in cyan/white tones.
 *
 * Performance notes:
 * - RAF loop cancels cleanly on unmount
 * - Canvas matches parent size via ResizeObserver
 * - Stars are pre-generated once, only position/alpha updated per frame
 */

import { useEffect, useRef } from "react";

interface Star {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  alphaDir: number; // 1 = brightening, -1 = dimming
  alphaSpeed: number;
  color: string;
}

const STAR_COUNT = 80;
const STAR_COLORS = [
  "255,255,255",   // white
  "45,212,255",    // APEX cyan
  "126,238,255",   // cyan-bright
  "200,240,255",   // pale blue-white
];

function makeStars(w: number, h: number): Star[] {
  return Array.from({ length: STAR_COUNT }, () => {
    const isCyan = Math.random() < 0.25;
    const colorIdx = isCyan
      ? Math.floor(Math.random() * 3) + 1
      : 0;
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.10,
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.6 + 0.1,
      alphaDir: Math.random() > 0.5 ? 1 : -1,
      alphaSpeed: Math.random() * 0.006 + 0.002,
      color: STAR_COLORS[colorIdx],
    };
  });
}

export function StarField({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef  = useRef<Star[]>([]);
  const rafRef    = useRef<number>(0);
  const sizeRef   = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.offsetWidth;
      const h = parent.offsetHeight;
      if (w === sizeRef.current.w && h === sizeRef.current.h) return;
      sizeRef.current = { w, h };
      canvas.width  = w;
      canvas.height = h;
      // Regenerate stars when size changes
      starsRef.current = makeStars(w, h);
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const draw = () => {
      const { w, h } = sizeRef.current;
      if (!w || !h) { rafRef.current = requestAnimationFrame(draw); return; }

      ctx.clearRect(0, 0, w, h);

      for (const s of starsRef.current) {
        // Move
        s.x += s.vx;
        s.y += s.vy;

        // Wrap around edges with a margin so stars don't pop in/out
        if (s.x < -4) s.x = w + 4;
        if (s.x > w + 4) s.x = -4;
        if (s.y < -4) s.y = h + 4;
        if (s.y > h + 4) s.y = -4;

        // Twinkle
        s.alpha += s.alphaDir * s.alphaSpeed;
        if (s.alpha >= 0.75) { s.alpha = 0.75; s.alphaDir = -1; }
        if (s.alpha <= 0.06) { s.alpha = 0.06; s.alphaDir =  1; }

        // Draw — larger stars get a soft glow halo
        if (s.r > 1.1) {
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3.5);
          grad.addColorStop(0,   `rgba(${s.color},${(s.alpha * 0.55).toFixed(3)})`);
          grad.addColorStop(1,   `rgba(${s.color},0)`);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 3.5, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Core dot
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${s.alpha.toFixed(3)})`;
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}
