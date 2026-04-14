"use client";

/**
 * ApexMark
 *
 * The APEX Marketing logo mark — the mountain / A-shape icon —
 * extracted from the brand logo. Used as the AERA message avatar.
 *
 * Two outer diagonal legs meeting at the apex, a horizontal crossbar
 * at the base, and an inner double-peak (M shape) inside the A.
 * All rendered in APEX cyan (#2DD4FF).
 */

export function ApexMark({
  size = 14,
  color = "#2DD4FF",
  opacity = 1,
  glow = false,
}: {
  size?: number;
  color?: string;
  opacity?: number;
  glow?: boolean;
}) {
  const strokeW = size <= 12 ? 1.8 : size <= 18 ? 2.0 : 2.4;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      style={{
        opacity,
        filter: glow ? `drop-shadow(0 0 ${size * 0.35}px ${color}cc)` : "none",
        flexShrink: 0,
      }}
    >
      {/* ── Outer A — left leg ── */}
      <path
        d="M3 26 L14 3"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* ── Outer A — right leg ── */}
      <path
        d="M14 3 L25 26"
        stroke={color}
        strokeWidth={strokeW}
        strokeLinecap="round"
      />
      {/* ── Outer A — bottom horizontal crossbar ── */}
      <path
        d="M6 21 L22 21"
        stroke={color}
        strokeWidth={strokeW * 0.85}
        strokeLinecap="round"
      />
      {/* ── Inner double-peak (mountain M) ──
          Left peak rises from the crossbar, right peak mirrors it,
          with a shallow valley between — exactly like the logo mark. */}
      <path
        d="M9 21 L12 14 L14 17 L16 14 L19 21"
        stroke={color}
        strokeWidth={strokeW * 0.78}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
