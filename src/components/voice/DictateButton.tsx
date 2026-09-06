"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

/**
 * Speech engine, browser side. Ported from the Eloy Connect dictation module.
 *  1. Mic -> short-lived Deepgram credential from /api/voice/deepgram-token
 *  2. Live socket: wss://api.deepgram.com/v1/listen (nova-2, smart_format, punctuate, interim, endpointing 300)
 *     Auth rides in the WebSocket subprotocol: ["token" | "bearer", credential]
 *  3. Commit is_final chunks only; a live waveform shows "listening" instead of jumpy interim text
 *  4. If the socket cannot open, fall back to record-then-transcribe via /api/voice/transcribe
 * On stop, the finished text is handed to onText (caller appends it to the box).
 */

const DG_URL = "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&interim_results=true&endpointing=300";
const BARS = 14;

type Phase = "idle" | "starting" | "listening" | "finishing";

export function DictateButton({ onText, size = 36, title = "Dictate" }: { onText: (text: string) => void; size?: number; title?: string }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));

  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalRef = useRef("");
  const chunksRef = useRef<Blob[]>([]);
  const batchModeRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);

  useEffect(() => () => { cleanup(); }, []);

  function startWave(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      audioCtxRef.current = ctx;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / BARS));
        const next: number[] = [];
        for (let i = 0; i < BARS; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
          next.push(Math.max(0.08, Math.min(1, sum / step / 200)));
        }
        setLevels(next);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch { /* waveform is optional */ }
  }

  function cleanup() {
    try { if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop(); } catch { /* ignore */ }
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    try { wsRef.current?.close(); } catch { /* ignore */ }
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    try { void audioCtxRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null; recRef.current = null; streamRef.current = null; audioCtxRef.current = null; rafRef.current = null;
    setLevels(Array(BARS).fill(0.08));
  }

  async function finish() {
    const text = finalRef.current.trim();
    if (text) onTextRef.current(text);
    finalRef.current = "";
    cleanup();
    setPhase("idle");
  }

  async function finishBatch() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    try {
      const res = await fetch("/api/voice/transcribe", { method: "POST", headers: { "Content-Type": "audio/webm" }, body: blob });
      const j = (await res.json()) as { transcript?: string };
      if (j.transcript) onTextRef.current(j.transcript.trim());
    } catch { /* nothing to add */ }
    cleanup();
    setPhase("idle");
  }

  async function start() {
    setPhase("starting");
    finalRef.current = "";
    chunksRef.current = [];
    batchModeRef.current = false;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("idle");
      return;
    }
    streamRef.current = stream;
    startWave(stream);

    let mode = "token";
    let cred = "";
    try {
      const r = await fetch("/api/voice/deepgram-token");
      const d = (await r.json()) as { mode?: string; access_token?: string };
      if (!d.access_token) throw new Error("no credential");
      mode = d.mode ?? "token";
      cred = d.access_token;
    } catch {
      // No live credential: record locally and transcribe in one shot on stop
      batchModeRef.current = true;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start(250);
      recRef.current = rec;
      setPhase("listening");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(DG_URL, [mode === "bearer" ? "bearer" : "token", cred]);
    } catch {
      batchModeRef.current = true;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.start(250);
      recRef.current = rec;
      setPhase("listening");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      try {
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
        rec.ondataavailable = (e) => { if (e.data.size && ws.readyState === 1) ws.send(e.data); };
        rec.start(250);
        recRef.current = rec;
        setPhase("listening");
      } catch {
        void finish();
      }
    };
    ws.onmessage = (msg) => {
      try {
        const d = JSON.parse(msg.data as string) as { is_final?: boolean; channel?: { alternatives?: { transcript?: string }[] } };
        const txt = d.channel?.alternatives?.[0]?.transcript ?? "";
        if (txt && d.is_final) finalRef.current += (finalRef.current ? " " : "") + txt;
      } catch { /* ignore */ }
    };
    ws.onclose = () => { if (wsRef.current === ws) void finish(); };
    ws.onerror = () => { /* onclose follows */ };
  }

  function stop() {
    setPhase("finishing");
    if (batchModeRef.current) {
      try { recRef.current?.stop(); } catch { /* ignore */ }
      setTimeout(() => void finishBatch(), 300);
      return;
    }
    try { if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop(); } catch { /* ignore */ }
    try { if (wsRef.current?.readyState === 1) wsRef.current.send(JSON.stringify({ type: "CloseStream" })); } catch { /* ignore */ }
    setTimeout(() => { try { wsRef.current?.close(); } catch { /* ignore */ } if (wsRef.current) void finish(); }, 450);
  }

  const active = phase === "listening";
  return (
    <button
      type="button"
      onClick={() => (phase === "idle" ? void start() : phase === "listening" ? stop() : null)}
      title={active ? "Stop" : title}
      aria-label={active ? "Stop dictation" : title}
      style={{
        display: "inline-flex", alignItems: "center", gap: 8, height: size, padding: active ? "0 12px 0 10px" : 0,
        width: active ? "auto" : size, borderRadius: 999, cursor: "pointer", flexShrink: 0,
        background: active ? "rgba(45,212,255,0.14)" : "var(--hover-fill)",
        border: "1px solid " + (active ? "rgba(45,212,255,0.55)" : "var(--border-mid)"),
        color: active ? "var(--cyan)" : "var(--text-4)",
        boxShadow: active ? "0 0 0 4px rgba(45,212,255,0.10), 0 0 24px rgba(45,212,255,0.18)" : "none",
        transition: "all 0.25s ease", justifyContent: "center",
      }}
    >
      {phase === "starting" || phase === "finishing" ? (
        <Loader2 className="animate-spin" style={{ width: 15, height: 15 }} />
      ) : active ? (
        <>
          <Square style={{ width: 11, height: 11, fill: "currentColor" }} />
          <span style={{ display: "flex", alignItems: "center", gap: 2, height: 18 }}>
            {levels.map((l, i) => (
              <span key={i} style={{ width: 2.5, height: Math.max(3, l * 18), borderRadius: 2, background: "var(--cyan)", transition: "height 0.08s linear" }} />
            ))}
          </span>
        </>
      ) : (
        <Mic style={{ width: 15, height: 15 }} />
      )}
    </button>
  );
}
