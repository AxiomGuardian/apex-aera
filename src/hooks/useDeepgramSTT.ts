"use client";

/**
 * useDeepgramSTT
 *
 * Production-grade real-time Speech-to-Text using Deepgram's WebSocket API.
 * Replaces the unreliable Chrome Web Speech API entirely.
 *
 * Architecture:
 *  1. Fetch a short-lived API token from /api/voice/deepgram-token (key never in browser)
 *  2. Open a WebSocket to wss://api.deepgram.com/v1/listen with streaming params
 *  3. Pipe raw microphone audio (via MediaRecorder) into the WebSocket
 *  4. Receive transcripts (interim + final) via WebSocket messages
 *  5. Auto-send after 0.6 s of silence following a final transcript
 *  6. Reconnect automatically on any WebSocket error or close
 *
 * Guarantees:
 *  - Truly unlimited duration (no 2–3 s cutoff)
 *  - Works across all browsers that support MediaRecorder + WebSocket
 *  - API key never touches the browser
 *  - Automatic reconnection on interruption
 */

import { useState, useRef, useCallback, useEffect } from "react";

export type DeepgramSTTOptions = {
  onInterim:  (text: string) => void;
  onAutoSend: (text: string) => void;
};

// Deepgram streaming endpoint
const DG_WSS = "wss://api.deepgram.com/v1/listen";

// Audio chunk interval — send audio to Deepgram every 250 ms
const CHUNK_MS = 250;

// Fallback send delay after a Deepgram is_final.
// Long (2500ms) because UtteranceEnd is the primary "done" signal and fires first.
// This timer is cancelled by any incoming interim (user still speaking), so in
// practice it only fires as a safety net when UtteranceEnd doesn't arrive.
const AUTO_SEND_DELAY = 2500;

export function useDeepgramSTT({ onInterim, onAutoSend }: DeepgramSTTOptions) {
  const [isListening,   setIsListening]   = useState(false);
  const [isConnecting,  setIsConnecting]  = useState(false);
  const [isMuted,       setIsMuted]       = useState(false);

  // Stable refs — never cause re-renders
  const shouldRunRef      = useRef(false);
  const mutedRef          = useRef(false);   // sync ref so ondataavailable reads current value
  const wsRef             = useRef<WebSocket | null>(null);
  const recorderRef       = useRef<MediaRecorder | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const finalBufferRef    = useRef("");
  const autoSendTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onInterimRef      = useRef(onInterim);
  const onAutoSendRef     = useRef(onAutoSend);

  // Keep callback refs current without triggering re-renders
  useEffect(() => { onInterimRef.current  = onInterim;  }, [onInterim]);
  useEffect(() => { onAutoSendRef.current = onAutoSend; }, [onAutoSend]);

  // ── Auto-send logic ───────────────────────────────────────────
  const clearAutoSend = useCallback(() => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  }, []);

  const scheduleAutoSend = useCallback(() => {
    clearAutoSend();
    autoSendTimerRef.current = setTimeout(() => {
      const text = finalBufferRef.current.trim();
      if (text && shouldRunRef.current) {
        onAutoSendRef.current(text);
        finalBufferRef.current = "";
        onInterimRef.current("");
      }
    }, AUTO_SEND_DELAY);
  }, [clearAutoSend]);

  // ── Internal teardown ─────────────────────────────────────────
  const teardown = useCallback(() => {
    // Stop MediaRecorder
    try {
      recorderRef.current?.stop();
    } catch { /* already stopped */ }
    recorderRef.current = null;

    // Stop microphone stream
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Close WebSocket
    try {
      wsRef.current?.close(1000, "stop");
    } catch { /* already closed */ }
    wsRef.current = null;

    // Clear timers
    clearAutoSend();
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, [clearAutoSend]);

  // ── Core: open WebSocket + start microphone ───────────────────
  const connect = useCallback(async () => {
    if (!shouldRunRef.current) return;

    // Fetch short-lived token from our secure server route
    let dgKey: string;
    try {
      const res = await fetch("/api/voice/deepgram-token");
      if (!res.ok) throw new Error(`Token fetch ${res.status}`);
      const data = await res.json() as { key: string };
      dgKey = data.key;
    } catch (err) {
      console.error("[Deepgram] token fetch failed:", err);
      // Retry in 2 s
      if (shouldRunRef.current) {
        reconnectTimerRef.current = setTimeout(connect, 2000);
      }
      return;
    }

    if (!shouldRunRef.current) return;

    // Request microphone
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
        video: false,
      });
    } catch (err) {
      console.error("[Deepgram] microphone access denied:", err);
      shouldRunRef.current = false;
      setIsListening(false);
      return;
    }

    if (!shouldRunRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    // Build Deepgram WebSocket URL with streaming params.
    // NOTE: No encoding/sample_rate — we send WebM/Opus from MediaRecorder and
    // Deepgram auto-detects the container. Specifying linear16 while sending WebM
    // would cause a mismatch and silent transcription failures on some browsers.
    const params = new URLSearchParams({
      model:            "nova-2",   // best accuracy
      language:         "en-US",
      smart_format:     "true",     // proper punctuation, grammar
      interim_results:  "true",     // live transcription display
      endpointing:      "700",      // ms of silence before Deepgram sends is_final
      utterance_end_ms: "1500",    // fire UtteranceEnd after 1.5s of real silence — faster response, still allows natural pauses
      filler_words:     "false",   // remove "um", "uh"
      punctuate:        "true",
      diarize:          "false",
    });

    // ── Domain keyword boosting ───────────────────────────────────
    // Deepgram's `keywords` param biases the acoustic model at the phoneme level.
    // Format: "word:intensity" 1–10 (higher = stronger pull toward that word).
    // This runs before the transcript reaches us, reducing mishears at the source.
    const keywords = [
      "AERA:10",       // critical — transcribed as "era", "error", "aria", "are a"
      "APEX:8",        // brand name — usually lowercased without boost
      "ROAS:8",        // marketing metric — sounds like "rows" or "rose"
      "ElevenLabs:6",
      "Deepgram:6",
      "Katherine:5",
      "claude:5",
    ];
    keywords.forEach((kw) => params.append("keywords", kw));

    // ── Hard word substitution (Deepgram `replace`) ───────────────
    // Unlike keyword boosting (probabilistic), `replace` is deterministic:
    // Deepgram substitutes the matched word in the final transcript text.
    // Only use for words that are NEVER legitimate in this context.
    // "aria" → the name Aria is not in scope here; almost always means AERA.
    // "aira", "ayra" → clear mishears with no valid alternative meaning.
    // DO NOT replace "era" or "error" — they are valid English words.
    const replacements = [
      "aria:AERA",   // Aria → AERA
      "aira:AERA",   // aira → AERA (phonetic mishear)
      "ayra:AERA",   // ayra → AERA (phonetic mishear)
    ];
    replacements.forEach((r) => params.append("replace", r));

    const wsUrl = `${DG_WSS}?${params.toString()}`;
    const ws = new WebSocket(wsUrl, ["token", dgKey]);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      if (!shouldRunRef.current) { ws.close(); return; }
      // WebSocket is open — mic is live, audio is flowing. NOW we're listening.
      setIsConnecting(false);
      setIsListening(true);

      // Start MediaRecorder — sends audio chunks into the WebSocket
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=pcm")
          ? "audio/webm;codecs=pcm"
          : "audio/webm",
      });

      recorder.ondataavailable = (e) => {
        // Skip sending audio when muted — WebSocket stays open so unmuting is instant
        if (ws.readyState === WebSocket.OPEN && e.data.size > 0 && !mutedRef.current) {
          ws.send(e.data);
        }
      };

      recorder.start(CHUNK_MS);
      recorderRef.current = recorder;
    };

    ws.onmessage = (evt) => {
      if (typeof evt.data !== "string") return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = JSON.parse(evt.data) as any;

        if (msg.type === "Results") {
          const channel    = msg.channel?.alternatives?.[0];
          const transcript = (channel?.transcript ?? "").trim();
          const isFinal    = msg.is_final as boolean;

          if (isFinal && transcript) {
            // Confirmed segment — add to buffer and arm the short fallback timer.
            // UtteranceEnd will fire if the user is truly done; otherwise a new
            // interim will cancel this timer before it fires.
            finalBufferRef.current += (finalBufferRef.current ? " " : "") + transcript;
            scheduleAutoSend();
            onInterimRef.current(finalBufferRef.current);
          } else if (!isFinal && transcript) {
            // ── KEY FIX: user is still speaking → cancel any pending send ──────
            // Without this, a is_final from a natural mid-sentence pause could
            // arm the timer and then fire even though the user resumed speaking.
            clearAutoSend();
            // Show live interim display (don't add to final buffer yet)
            onInterimRef.current((finalBufferRef.current + " " + transcript).trim());
          }
        }

        // ── UtteranceEnd = authoritative "user is done" signal ───────────────
        // Deepgram fires this only after utterance_end_ms (1800ms) of real silence.
        // Skip the extra AUTO_SEND_DELAY and fire immediately — we already know
        // the user has finished their thought.
        if (msg.type === "UtteranceEnd") {
          const text = finalBufferRef.current.trim();
          if (text && shouldRunRef.current) {
            clearAutoSend(); // cancel any pending fallback timer
            onAutoSendRef.current(text);
            finalBufferRef.current = "";
            onInterimRef.current("");
          }
        }

      } catch { /* ignore parse errors */ }
    };

    ws.onerror = (err) => {
      console.error("[Deepgram] WebSocket error:", err);
    };

    ws.onclose = (evt) => {
      recorderRef.current?.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;

      // Reconnect if we're still supposed to be listening
      if (shouldRunRef.current && evt.code !== 1000) {
        setIsListening(false);
        setIsConnecting(true); // reconnecting
        reconnectTimerRef.current = setTimeout(connect, 500);
      } else {
        setIsListening(false);
        setIsConnecting(false);
      }
    };
  }, [scheduleAutoSend]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public API ────────────────────────────────────────────────
  const start = useCallback(() => {
    if (shouldRunRef.current) return;
    finalBufferRef.current  = "";
    shouldRunRef.current    = true;
    // Show "connecting" immediately but NOT "listening" — we're not capturing audio yet.
    // isListening only becomes true in ws.onopen when the WebSocket is actually open
    // and the MediaRecorder is running. This prevents the user from speaking before
    // we're ready and losing the first few words.
    setIsConnecting(true);
    setIsListening(false);
    connect();
  }, [connect]);

  const stop = useCallback(() => {
    shouldRunRef.current = false;
    mutedRef.current     = false;
    finalBufferRef.current = "";
    clearAutoSend();
    teardown();
    setIsListening(false);
    setIsConnecting(false);
    setIsMuted(false);
  }, [clearAutoSend, teardown]);

  const cancelAutoSend = useCallback(() => {
    clearAutoSend();
  }, [clearAutoSend]);

  // ── Mute / unmute ─────────────────────────────────────────────
  // Muting stops audio chunks from reaching Deepgram but keeps the WebSocket
  // open — unmuting is instant with no reconnect delay.
  // Muting also clears any pending auto-send so a partial transcript
  // in the buffer isn't accidentally sent while the mic is silenced.
  const mute = useCallback(() => {
    mutedRef.current = true;
    setIsMuted(true);
    clearAutoSend();
    finalBufferRef.current = "";    // discard any partial buffer
    onInterimRef.current("");       // clear interim display
  }, [clearAutoSend]);

  const unmute = useCallback(() => {
    mutedRef.current = false;
    setIsMuted(false);
  }, []);

  const toggleMute = useCallback(() => {
    if (mutedRef.current) unmute();
    else mute();
  }, [mute, unmute]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRunRef.current = false;
      teardown();
    };
  }, [teardown]);

  return { isListening, isConnecting, isMuted, start, stop, toggleMute, cancelAutoSend };
}

// ── Audio visualizer (unchanged — microphone level bars) ──────────────────────
// Re-exported from useVoice for backward compatibility
export { useAudioVisualizer } from "./useVoice";
