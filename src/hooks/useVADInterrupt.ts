"use client";

/**
 * useVADInterrupt
 *
 * Voice Activity Detection for interrupt capability.
 * When active (isSpeaking && voiceMode), opens the mic with echoCancellation
 * and monitors amplitude via AnalyserNode. If the user's voice sustains above
 * VAD_THRESHOLD for VAD_HOLD_MS milliseconds, fires onDetect() once — then
 * stops monitoring.
 *
 * echoCancellation: true filters out AERA's own TTS speaker output, so only
 * the user's voice triggers the interrupt (not AERA talking to herself).
 *
 * Usage:
 *   useVADInterrupt({
 *     active: isSpeaking && voiceMode,
 *     onDetect: () => { stopSpeaking(); vcStart(); startViz(); },
 *   });
 */

import { useEffect, useRef } from "react";

const VAD_THRESHOLD = 0.09;  // 9% RMS — reliable for normal conversational speech
const VAD_HOLD_MS   = 90;    // 90ms hold — fast enough to feel instant, avoids transients
const FFT_SIZE      = 256;   // small FFT → low CPU, sufficient for amplitude

export function useVADInterrupt({
  active,
  onDetect,
}: {
  active: boolean;
  onDetect: () => void;
}) {
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect; // always latest without re-running effect

  useEffect(() => {
    if (!active) return;
    if (typeof window === "undefined") return;

    let stream:     MediaStream | null       = null;
    let audioCtx:   AudioContext | null      = null;
    let analyser:   AnalyserNode | null      = null;
    let source:     MediaStreamAudioSourceNode | null = null;
    let rafId:      number | null            = null;
    let fired       = false;
    let aboveStart: number | null            = null; // timestamp when level first went above threshold

    const cleanup = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
      try { source?.disconnect(); } catch { /* ignore */ }
      try { analyser?.disconnect(); } catch { /* ignore */ }
      try { audioCtx?.close(); } catch { /* ignore */ }
      stream?.getTracks().forEach(t => t.stop());
      stream = null; audioCtx = null; analyser = null; source = null;
    };

    const loop = () => {
      if (fired || !analyser) return;

      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);

      // RMS amplitude
      let sumSq = 0;
      for (let i = 0; i < data.length; i++) sumSq += data[i] * data[i];
      const rms = Math.sqrt(sumSq / data.length);

      const now = performance.now();

      if (rms >= VAD_THRESHOLD) {
        if (aboveStart === null) aboveStart = now;
        else if (now - aboveStart >= VAD_HOLD_MS) {
          // Sustained human-level voice detected — fire interrupt
          fired = true;
          cleanup();
          onDetectRef.current();
          return;
        }
      } else {
        aboveStart = null; // reset hold timer on any dip below threshold
      }

      rafId = requestAnimationFrame(loop);
    };

    // Async: open mic, wire up AudioContext, start loop
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation:   true,  // filter out AERA's speaker output
            noiseSuppression:   true,
            autoGainControl:    false, // don't boost quiet ambient noise into false positives
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        audioCtx = new (window.AudioContext ?? (window as any).webkitAudioContext)();

        // ── CRITICAL: resume the AudioContext ────────────────────────
        // Chrome creates AudioContexts in "suspended" state when the
        // constructor runs outside a direct synchronous user gesture.
        // In "suspended" state the audio processing graph is paused and
        // getFloatTimeDomainData() returns all-zero arrays — causing the
        // VAD to never detect any speech. resume() fixes this.
        await audioCtx.resume();

        analyser = audioCtx.createAnalyser();
        analyser.fftSize              = FFT_SIZE;
        analyser.smoothingTimeConstant = 0; // no smoothing — react instantly

        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        // NOTE: analyser NOT connected to destination — silent monitoring only

        rafId = requestAnimationFrame(loop);
      } catch (err) {
        // Mic permission denied or unavailable — fail silently (interrupt just won't work)
        console.warn("[AERA VAD] mic unavailable for interrupt detection:", err);
        cleanup();
      }
    })();

    return cleanup;
  }, [active]); // re-run only when active flips
}
