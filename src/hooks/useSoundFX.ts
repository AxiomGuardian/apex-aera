"use client";

/**
 * useSoundFX
 *
 * Synthesizes UI sound effects using the Web Audio API — no audio files needed.
 * All tones are generated procedurally for instant playback with zero load time.
 *
 * send()    — short rising digital chirp, feels fast and decisive
 * receive() — soft chime-pad with harmonics, feels warm and intelligent
 */

import { useRef, useCallback } from "react";

export function useSoundFX() {
  const ctxRef = useRef<AudioContext | null>(null);

  /** Lazily create AudioContext on first use (requires user interaction) */
  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      try {
        ctxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume().catch(() => {});
    }
    return ctxRef.current;
  }, []);

  /** Short rising chirp — played on user message send */
  const send = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = "triangle";
    // Rising frequency: 520Hz → 820Hz over 90ms
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(820, now + 0.09);

    // Fast attack, instant release — decisive click feel
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.10, now + 0.010);
    gain.gain.linearRampToValueAtTime(0.07, now + 0.055);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.start(now);
    osc.stop(now + 0.13);
  }, [getCtx]);

  /** Soft harmonic chime — played on AERA message receive */
  const receive = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Layer two oscillators for a warm chime (fundamental + 5th)
    const playNote = (freq: number, vol: number, delay: number) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(vol, now + delay + 0.025);
      gain.gain.setValueAtTime(vol, now + delay + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.38);

      osc.start(now + delay);
      osc.stop(now + delay + 0.40);
    };

    // Root + perfect 5th + octave — APEX cyan feel
    playNote(440, 0.065, 0.000);   // A4
    playNote(660, 0.040, 0.008);   // E5 (5th)
    playNote(880, 0.020, 0.016);   // A5 (octave — subtle sparkle)
  }, [getCtx]);

  return { send, receive };
}
