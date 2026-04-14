"use client";

/**
 * useElevenLabsTTS
 *
 * Production TTS via ElevenLabs secure server proxy.
 * NO browser TTS fallback — AERA is silent if ElevenLabs is unavailable.
 * This ensures the voice is always AERA's voice or nothing at all.
 *
 * Autoplay fix:
 *   Modern browsers block audio.play() when there's no active user gesture in
 *   the call stack. Because speak() is called ~5-8 seconds after the user's
 *   original gesture (waiting for AERA API + ElevenLabs), the browser blocks
 *   the Audio element entirely.
 *
 *   Solution: use AudioContext + decodeAudioData + createBufferSource instead
 *   of the Audio element. Call unlockAudio() during ANY user gesture (e.g. the
 *   voice mode toggle click) to resume() the AudioContext. A resumed context
 *   stays unlocked and can play audio asynchronously without restrictions.
 *
 * Self-echo prevention:
 *   isSpeaking is set to TRUE synchronously in speak() — before any async
 *   fetch — so the aeraIsBusy signal in chat/page.tsx always reflects the
 *   speaking state before the mic restart timer can fire.
 *
 * Voice: Katherine (NtS6nEHDYMQC9QczMQuq) — Calm Luxury · Narration · English.
 *        Named "AERA" throughout the codebase.
 *        Model: eleven_flash_v2_5 → eleven_turbo_v2_5 → eleven_turbo_v2 (fallback chain).
 */

import { useState, useRef, useCallback } from "react";

export type TTSSpeed = 1 | 1.5 | 2 | 2.5;
export const TTS_SPEEDS: TTSSpeed[] = [1, 1.5, 2, 2.5];

export type ElevenLabsTTSReturn = {
  isSpeaking:         boolean;
  speakingMessageId:  string | null;
  speak:              (text: string, id: string) => void;
  stop:               () => void;
  /** Call this inside any user gesture (e.g. voice mode toggle) to unlock
   *  the AudioContext so async playback works without autoplay restrictions. */
  unlockAudio:        () => void;
  ttsSpeed:           TTSSpeed;
  setTtsSpeed:        (speed: TTSSpeed) => void;
};

// ── Main hook ────────────────────────────────────────────────────
export function useElevenLabsTTS(): ElevenLabsTTSReturn {
  const [isSpeaking,        setIsSpeaking]        = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [ttsSpeed,          setTtsSpeed]          = useState<TTSSpeed>(1);
  const ttsSpeedRef = useRef<TTSSpeed>(1);

  // Keep ref in sync so speak() always reads the current speed even when
  // called from inside a stale closure.
  const handleSetTtsSpeed = useCallback((speed: TTSSpeed) => {
    ttsSpeedRef.current = speed;
    setTtsSpeed(speed);
  }, []);

  // AudioContext stays alive for the component lifetime.
  // resume() in unlockAudio() removes the autoplay restriction permanently.
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const abortRef      = useRef<AbortController | null>(null);

  // ── Unlock AudioContext (call in a user gesture) ─────────────
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      audioCtxRef.current = new (window.AudioContext ?? (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {/* ignore */});
    }
  }, []);

  // ── Internal cleanup (does NOT reset React state) ────────────
  const cancelAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    try { sourceNodeRef.current?.stop(); } catch { /* already stopped */ }
    sourceNodeRef.current = null;
  }, []);

  // ── Full teardown (resets React state) ───────────────────────
  const teardown = useCallback(() => {
    cancelAudio();
    setIsSpeaking(false);
    setSpeakingMessageId(null);
  }, [cancelAudio]);

  // ── Public: stop ──────────────────────────────────────────────
  const stop = useCallback(() => {
    teardown();
  }, [teardown]);

  // ── Public: speak ─────────────────────────────────────────────
  const speak = useCallback((text: string, id: string) => {
    // ── SELF-ECHO FIX ──────────────────────────────────────────
    // Cancel any existing audio WITHOUT resetting React state first.
    // Immediately set isSpeaking=true synchronously so aeraIsBusy
    // never drops to false between this call and the async fetch.
    cancelAudio();
    setIsSpeaking(true);
    setSpeakingMessageId(id);

    const controller = new AbortController();
    abortRef.current = controller;

    const run = async () => {
      try {
        const res = await fetch("/api/voice/tts", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          // Pass speed to ElevenLabs API — pitch-preserving server-side time-stretch.
          // Do NOT use AudioBufferSourceNode.playbackRate (that shifts pitch too).
          body:    JSON.stringify({ text, speed: ttsSpeedRef.current }),
          signal:  controller.signal,
        });

        if (!res.ok) {
          // ElevenLabs returned an error — AERA goes silent (no browser fallback).
          // Check DevTools Console for the exact error and model attempted.
          // Most common causes:
          //   502 → all models in the priority chain failed (check plan/key)
          //   401 → API key invalid or missing text_to_speech permission
          //   422 → voice_settings incompatible with plan tier
          try {
            const errBody = await res.json() as { error?: string; details?: string };
            console.error(
              `[AERA TTS] ❌ ElevenLabs ${res.status} — voice muted for this response.\n`,
              "Error:", errBody.details ?? errBody.error ?? "(no detail)",
              "\nCheck your ElevenLabs plan at elevenlabs.io — Starter ($5/mo) unlocks all models.",
            );
          } catch {
            console.error(`[AERA TTS] ❌ ElevenLabs ${res.status} — voice muted.`);
          }
          teardown();
          return;
        }

        // ── AudioContext playback (no autoplay restriction) ──────
        const model       = res.headers.get("X-ElevenLabs-Model") ?? "unknown";
        const arrayBuffer = await res.arrayBuffer();
        if (controller.signal.aborted) return;

        // Lazily create AudioContext if unlockAudio() was never called
        if (!audioCtxRef.current) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          audioCtxRef.current = new (window.AudioContext ?? (window as any).webkitAudioContext)();
        }
        const ctx = audioCtxRef.current;

        // Resume in case it became suspended (e.g. tab backgrounded)
        if (ctx.state === "suspended") {
          await ctx.resume();
        }

        if (controller.signal.aborted) return;

        // Decode MP3 → AudioBuffer
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
        if (controller.signal.aborted) return;

        // Create and start source node.
        // playbackRate gives the biggest audible speed difference — the slight
        // pitch shift at 1.5x is acceptable and far more noticeable than
        // ElevenLabs server-side speed alone (which caps internally).
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = ttsSpeedRef.current;
        source.connect(ctx.destination);
        sourceNodeRef.current = source;

        source.onended = () => {
          if (!controller.signal.aborted) teardown();
        };

        source.start(0);
        console.log(`[AERA TTS] ✓ playing via AudioContext · model: ${model}`);

      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Intentional stop — reset state cleanly
          setIsSpeaking(false);
          setSpeakingMessageId(null);
          return;
        }
        console.error("[AERA TTS] ❌ unexpected error — voice muted:", err);
        teardown();
      }
    };

    run();
  }, [cancelAudio, teardown]);

  return { isSpeaking, speakingMessageId, speak, stop, unlockAudio, ttsSpeed, setTtsSpeed: handleSetTtsSpeed };
}
