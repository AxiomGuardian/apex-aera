"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  dir: number;
  speed: number;
  color: string;
};

const COLORS = [
  "244,241,232",
  "212,175,55",
  "168,176,192",
  "59,130,246",
];

function makeStars(w: number, h: number, count: number): Star[] {
  return Array.from({ length: count }, () => {
    const gold = Math.random() < 0.12;
    const blue = !gold && Math.random() < 0.08;
    const color = gold ? COLORS[1] : blue ? COLORS[3] : COLORS[Math.random() < 0.5 ? 0 : 2];
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.04,
      vy: (Math.random() - 0.5) * 0.03,
      r: Math.random() * 1.1 + 0.25,
      alpha: Math.random() * 0.28 + 0.06,
      dir: Math.random() > 0.5 ? 1 : -1,
      speed: Math.random() * 0.0025 + 0.0008,
      color,
    };
  });
}

export function KitStarfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let stars: Star[] = [];
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      w = canvas.parentElement?.offsetWidth ?? window.innerWidth;
      h = canvas.parentElement?.offsetHeight ?? window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stars = makeStars(w, h, reduce ? 40 : 70);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduce) {
          s.x += s.vx;
          s.y += s.vy;
          if (s.x < -4) s.x = w + 4;
          if (s.x > w + 4) s.x = -4;
          if (s.y < -4) s.y = h + 4;
          if (s.y > h + 4) s.y = -4;
          s.alpha += s.dir * s.speed;
          if (s.alpha >= 0.38) {
            s.alpha = 0.38;
            s.dir = -1;
          }
          if (s.alpha <= 0.05) {
            s.alpha = 0.05;
            s.dir = 1;
          }
        }
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.color},${s.alpha.toFixed(3)})`;
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };

    resize();
    draw();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0"
      style={{ opacity: 0.55 }}
    />
  );
}
