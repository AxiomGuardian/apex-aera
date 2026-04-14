"use client";

/* ─────────────────────────────────────────────────────────────
   VoiceWave — Premium real-time audio waveform
   Bright cyan bars driven by Web Audio API AnalyserNode.
   Center bars are taller (cubic weighting).
   Overall amplitude drives a visible cyan glow on the container.
───────────────────────────────────────────────────────────── */

const CYAN = "45,212,255";

export function VoiceWave({
  bars,
  amplitude = 0,
  height = 44,
  compact = false,
}: {
  bars: number[];
  amplitude?: number;
  height?: number;
  compact?: boolean;
}) {
  const barWidth  = compact ? 2   : 2.5;
  const barGap    = compact ? 1.5 : 2;
  const maxHeight = height - 6;

  // Container glow — vivid cyan pulse that tracks amplitude
  const glowOpacity = Math.min(0.75, amplitude * 1.3 + 0.10);
  const glowRadius  = Math.round(10 + amplitude * 32);

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: barGap,
        height,
        width: "100%",
        overflow: "hidden",
        borderRadius: 8,
        // Vivid ambient glow that pulses with the speaker's voice
        filter: amplitude > 0.05
          ? `drop-shadow(0 0 ${glowRadius}px rgba(${CYAN},${glowOpacity}))`
          : undefined,
        transition: "filter 0.08s ease",
      }}
    >
      {bars.map((level, i) => {
        // Cubic center-weighting: center bars are full height,
        // edges taper naturally
        const t         = (i / (bars.length - 1)) * 2 - 1; // -1 → 1
        const midFactor = 1 - Math.pow(Math.abs(t), 1.8) * 0.52;

        // Minimum height so bars are always visible, even in silence
        const h = Math.max(compact ? 3 : 4, Math.round(level * maxHeight * midFactor));

        // High base opacity — bars are bright and clearly visible at any amplitude
        const opacity = Math.max(0.45, Math.min(1, level * 0.7 + 0.42)) * (midFactor * 0.35 + 0.65);

        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: h,
              borderRadius: barWidth,
              background: `rgba(${CYAN},${opacity.toFixed(2)})`,
              // Individual bar glow — fires at lower threshold for richer look
              boxShadow: level > 0.25
                ? `0 0 ${Math.round(level * 10)}px rgba(${CYAN},${(level * 0.65).toFixed(2)})`
                : undefined,
              transition: "height 0.045s linear, opacity 0.045s linear",
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   IdleWave — CSS-only breathing bars when mic isn't active.
   Clearly visible even at rest — not too subtle to notice.
───────────────────────────────────────────────────────────── */
const IDLE_HEIGHTS = [
  2, 4, 7, 11, 8, 14, 9, 6, 13, 7, 4, 10, 14, 7, 4,
  14, 7, 10, 4, 13, 6, 9, 14, 8, 11, 7, 4, 2,
  4, 8, 12, 6,
];

export function IdleWave({ height = 44, compact = false }: { height?: number; compact?: boolean }) {
  const barWidth = compact ? 2 : 2.5;
  const barGap   = compact ? 1.5 : 2;

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: barGap,
        height,
        width: "100%",
        overflow: "hidden",
      }}
    >
      {IDLE_HEIGHTS.map((baseH, i) => {
        const delay = (i * 0.055).toFixed(2);
        return (
          <div
            key={i}
            style={{
              width: barWidth,
              height: baseH,
              borderRadius: barWidth,
              background: `rgba(${CYAN},0.38)`,
              animation: `aera-idle-bar 2.2s ease-in-out ${delay}s infinite alternate`,
              flexShrink: 0,
            }}
          />
        );
      })}
      <style>{`
        @keyframes aera-idle-bar {
          from { opacity: 0.25; transform: scaleY(0.45); }
          to   { opacity: 0.70; transform: scaleY(1);   }
        }
      `}</style>
    </div>
  );
}
