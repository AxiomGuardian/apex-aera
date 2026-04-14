"use client";

import { useState, useRef, useCallback } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = any;

function getSpeechRecognitionAPI(): AnyObj | null {
  if (typeof window === "undefined") return null;
  const w = window as AnyObj;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/* ─────────────────────────────────────────────────────────────
   useContinuousSpeechToText
   Runs continuously until stop() is called.
   Accumulates final transcripts; auto-sends after 1.4 s silence.
   Each restart creates a FRESH SpeechRecognition instance —
   Chrome is unreliable when restarting the same object.
───────────────────────────────────────────────────────────── */
export function useContinuousSpeechToText({
  onInterim,
  onAutoSend,
}: {
  onInterim: (text: string) => void;
  onAutoSend: (text: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);

  const recognitionRef     = useRef<AnyObj>(null);
  const shouldListenRef    = useRef(false);
  const finalBufferRef     = useRef("");
  const autoSendTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInterimRef       = useRef(onInterim);
  const onAutoSendRef      = useRef(onAutoSend);
  onInterimRef.current     = onInterim;
  onAutoSendRef.current    = onAutoSend;

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  };

  const scheduleAutoSend = () => {
    clearAutoSendTimer();
    autoSendTimerRef.current = setTimeout(() => {
      const text = finalBufferRef.current.trim();
      if (text) {
        onAutoSendRef.current(text);
        finalBufferRef.current = "";
        onInterimRef.current("");
      }
    }, 1400);
  };

  // createAndStart makes a FRESH recognition instance every time —
  // avoids Chrome's unreliable restart-same-object behavior.
  const createAndStart = useCallback(() => {
    const API = getSpeechRecognitionAPI();
    if (!API || !shouldListenRef.current) return;

    // Abort any existing instance first
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;

    const recognition: AnyObj = new API();
    // ── continuous=false is the reliable pattern for Chrome ──────
    // With continuous=true, Chrome has a well-documented bug where it fires
    // onresult once, then silently stops transcribing while keeping the
    // session "open". The mic appears live but nothing is processed.
    // With continuous=false, Chrome fully processes one utterance, fires onend,
    // and we immediately create a fresh instance — giving seamless continuity
    // without Chrome's continuous-mode reliability problems.
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (shouldListenRef.current) setIsListening(true);
    };

    recognition.onend = () => {
      if (shouldListenRef.current) {
        // Immediately restart for next utterance — this IS the continuity mechanism
        restartTimerRef.current = setTimeout(() => {
          createAndStart();
        }, 80);
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (e: AnyObj) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        shouldListenRef.current = false;
        setIsListening(false);
      }
      // Other errors (no-speech, network): onend fires and triggers restart
    };

    recognition.onresult = (e: AnyObj) => {
      let interim = "";
      let newFinal = "";

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (result.isFinal) {
          newFinal += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (newFinal) {
        finalBufferRef.current += newFinal + " ";
        scheduleAutoSend();
      }

      onInterimRef.current((finalBufferRef.current + interim).trim());
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      console.warn("[AERA STT] start() threw:", err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(() => {
    if (shouldListenRef.current) return;
    finalBufferRef.current  = "";
    shouldListenRef.current = true;
    setIsListening(true); // optimistic — UI responds immediately
    createAndStart();
  }, [createAndStart]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    clearAutoSendTimer();
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;
    finalBufferRef.current = "";
    setIsListening(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cancelAutoSend = useCallback(() => {
    clearAutoSendTimer();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { isListening, start, stop, cancelAutoSend };
}

/* ─────────────────────────────────────────────────────────────
   useAudioVisualizer
   Taps the microphone via Web Audio API (AnalyserNode) and
   returns per-bar amplitude levels (0–1) for the waveform.

   Uses log-scale frequency mapping so speech frequencies
   (200–3000 Hz) occupy the center of the display.

   Calls ctx.resume() explicitly — Chrome starts AudioContexts
   in "suspended" state when created outside a direct gesture,
   which would produce zero data from the AnalyserNode.
───────────────────────────────────────────────────────────── */
export const BAR_COUNT = 32;
const EMPTY_BARS = Array(BAR_COUNT).fill(0) as number[];

export function useAudioVisualizer() {
  const [bars, setBars]           = useState<number[]>(EMPTY_BARS);
  const [amplitude, setAmplitude] = useState(0);
  const streamRef  = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const animRef    = useRef<number>(0);

  const start = useCallback(async () => {
    if (streamRef.current) return; // already active

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });

      const ctx      = new AudioContext();

      // Chrome requires explicit resume when AudioContext is created
      // outside a synchronous user gesture — without this the
      // AnalyserNode returns all-zero data.
      await ctx.resume();

      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();

      analyser.fftSize               = 128;
      analyser.smoothingTimeConstant = 0.78;
      analyser.minDecibels           = -80;
      analyser.maxDecibels           = -10;

      source.connect(analyser);
      streamRef.current  = stream;
      contextRef.current = ctx;

      const data = new Uint8Array(analyser.frequencyBinCount); // 64 bins

      const tick = () => {
        analyser.getByteFrequencyData(data);

        const logMin = Math.log(1);
        const logMax = Math.log(data.length - 1);

        let sum = 0;
        const newBars = Array.from({ length: BAR_COUNT }, (_, i) => {
          const t        = i / (BAR_COUNT - 1);
          const logIdx   = logMin + t * (logMax - logMin);
          const binIndex = Math.round(Math.exp(logIdx));
          const raw      = data[Math.min(binIndex, data.length - 1)] ?? 0;
          const level    = Math.min(1, raw / 255);
          sum += level;
          return level;
        });

        setAmplitude(sum / BAR_COUNT);
        setBars(newBars);
        animRef.current = requestAnimationFrame(tick);
      };

      tick();
    } catch (err) {
      console.warn("[AERA Viz] Microphone access unavailable:", err);
    }
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(animRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    contextRef.current?.close().catch(() => { /* already closed */ });
    streamRef.current  = null;
    contextRef.current = null;
    setBars(EMPTY_BARS);
    setAmplitude(0);
  }, []);

  return { bars, amplitude, start, stop };
}

/* ─────────────────────────────────────────────────────────────
   formatSpeechText
   Polishes raw Web Speech API output for the simple mic button.
   Deepgram handles its own smart_format+punctuate; this covers
   the Web Speech API path only (text mode dictation mic).

   Rules:
   - Capitalize first letter of each sentence
   - Fix standalone "i" → "I"
   - Add terminal punctuation if the utterance ends without any
───────────────────────────────────────────────────────────── */
function formatSpeechText(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Capitalize start of each sentence (after . ! ?)
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase());

  // Standalone "i" → "I"  (word boundary on both sides)
  text = text.replace(/\bi\b/g, "I");

  // Add period if no terminal punctuation
  if (!/[.!?]$/.test(text)) text += ".";

  return text;
}

/* ─────────────────────────────────────────────────────────────
   useSpeechToText  (text-mode quick dictation mic)
   Continuous: listens indefinitely until stop() is called.
   Fires each final transcript chunk into the input field
   as the user speaks. Fresh-instance restart pattern keeps
   Chrome reliable — same approach as useContinuousSpeechToText.
   No auto-send — the user controls when to submit.
───────────────────────────────────────────────────────────── */
export function useSpeechToText(onResult: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const shouldRunRef    = useRef(false);
  const recognitionRef  = useRef<AnyObj>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef     = useRef(onResult);
  onResultRef.current   = onResult;

  const createAndStart = useCallback(() => {
    const API = getSpeechRecognitionAPI();
    if (!API || !shouldRunRef.current) return;

    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;

    const recognition: AnyObj = new API();
    // continuous=false — same fix as useContinuousSpeechToText.
    // Fresh-instance restart on onend provides the continuity.
    recognition.continuous     = false;
    recognition.interimResults = true;
    recognition.lang           = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      if (shouldRunRef.current) setIsListening(true);
    };

    recognition.onend = () => {
      if (shouldRunRef.current) {
        restartTimerRef.current = setTimeout(() => { createAndStart(); }, 80);
      } else {
        setIsListening(false);
      }
    };

    recognition.onerror = (e: AnyObj) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        shouldRunRef.current = false;
        setIsListening(false);
      }
      // no-speech / network: onend fires and triggers restart
    };

    recognition.onresult = (e: AnyObj) => {
      // Emit each final chunk immediately so the input field updates live.
      // Run through formatSpeechText to match Deepgram's smart_format quality:
      // proper capitalization, standalone-I fix, and terminal punctuation.
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const raw = (e.results[i][0]?.transcript ?? "").trim();
          if (raw) onResultRef.current(formatSpeechText(raw));
        }
      }
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (err) {
      console.warn("[AERA Dictation] start() threw:", err);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(() => {
    if (shouldRunRef.current) return;
    shouldRunRef.current = true;
    setIsListening(true); // optimistic
    createAndStart();
  }, [createAndStart]);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    try { recognitionRef.current?.abort(); } catch { /* ignore */ }
    recognitionRef.current = null;
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (shouldRunRef.current) stop();
    else start();
  }, [start, stop]);

  return { isListening, start, stop, toggle };
}
