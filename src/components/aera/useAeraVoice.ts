"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web voice layer, same shape as the phone: Deepgram live -> AERA brain -> Aura voice -> listen again.
 * Auth rides in the WebSocket subprotocol; the key never leaves the server.
 */
const DG_URL = "wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&interim_results=true&endpointing=300&keywords=AERA:5&keywords=APEX:3";

export type VoiceState = "idle" | "listening" | "thinking" | "speaking";
export type UIDirective = { type: string; tab?: string; kind?: string; id?: string };

export function fixName(t: string): string {
  return t.replace(/\b(arrow|era|ara|aira|ayra|erra|aera)\b/gi, "AERA");
}

export function useAeraVoice(opts: { onDirective?: (d: UIDirective) => void; onExchange?: (user: string, aera: string) => void; voice: () => string }) {
  const [active, setActive] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const [muted, setMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finalRef = useRef("");
  const historyRef = useRef<{ role: string; content: string }[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingConfirmRef = useRef(false);
  const meterRef = useRef<number | null>(null);

  const stopMic = useCallback(() => {
    try { recRef.current?.state !== "inactive" && recRef.current?.stop(); } catch { /* ignore */ }
    try { wsRef.current?.readyState === 1 && wsRef.current.send(JSON.stringify({ type: "CloseStream" })); } catch { /* ignore */ }
    setTimeout(() => { try { wsRef.current?.close(); } catch { /* ignore */ } }, 300);
    wsRef.current = null; recRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null;
    if (meterRef.current) cancelAnimationFrame(meterRef.current);
    setLevel(0);
  }, []);

  const speak = useCallback(async (text: string) => {
    setSaid(text); setState("speaking");
    try {
      const r = await fetch("/api/voice/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: opts.voice() }) });
      if (!r.ok) throw new Error("voice " + r.status);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url); a.volume = 1; audioRef.current = a;
      await new Promise<void>((res) => { a.onended = () => res(); a.onerror = () => res(); void a.play().catch(() => res()); });
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "voice failed"); }
    audioRef.current = null;
    if (activeRef.current) void listen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respond = useCallback(async (text: string, confirm: boolean) => {
    historyRef.current.push({ role: "user", content: text });
    try {
      const r = await fetch("/api/aera/act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: historyRef.current.slice(-16), confirm }) });
      const j = (await r.json()) as { say?: string; ui?: UIDirective[]; needsConfirm?: unknown };
      for (const d of j.ui ?? []) opts.onDirective?.(d);
      pendingConfirmRef.current = !!j.needsConfirm;
      const say = j.say ?? "Done.";
      historyRef.current.push({ role: "assistant", content: say });
      opts.onExchange?.(text, say);
      await speak(say);
    } catch {
      await speak("I could not reach the server just now.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  const listen = useCallback(async () => {
    if (!activeRef.current) return;
    setHeard(""); finalRef.current = ""; setState("listening"); setError(null);
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setError("Microphone permission is off."); return; }
    streamRef.current = stream;
    // level meter
    try {
      const ctx = new AudioContext(); const src = ctx.createMediaStreamSource(stream); const an = ctx.createAnalyser(); an.fftSize = 256; src.connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => { an.getByteTimeDomainData(buf); let s = 0; for (const v of buf) { const d = (v - 128) / 128; s += d * d; } setLevel(mutedRef.current ? 0 : Math.min(1, Math.sqrt(s / buf.length) * 6)); meterRef.current = requestAnimationFrame(tick); };
      tick();
    } catch { /* no meter */ }

    let cred: { mode?: string; access_token?: string } = {};
    try { cred = await (await fetch("/api/voice/deepgram-token")).json(); } catch { /* handled below */ }
    if (!cred.access_token) { setError("Live speech unavailable."); return; }
    const ws = new WebSocket(DG_URL, [cred.mode === "bearer" ? "bearer" : "token", cred.access_token]);
    wsRef.current = ws;
    ws.onopen = () => {
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      rec.ondataavailable = (e) => { if (e.data.size && ws.readyState === 1 && !mutedRef.current) ws.send(e.data); };
      rec.start(250); recRef.current = rec;
    };
    ws.onmessage = (msg) => {
      try {
        const d = JSON.parse(msg.data as string) as { is_final?: boolean; speech_final?: boolean; channel?: { alternatives?: { transcript?: string }[] } };
        const piece = d.channel?.alternatives?.[0]?.transcript ?? "";
        if (d.is_final) {
          if (piece) finalRef.current = (finalRef.current + " " + piece).trim();
          setHeard(fixName(finalRef.current));
          if (d.speech_final && finalRef.current) {
            const text = fixName(finalRef.current); finalRef.current = "";
            stopMic(); setState("thinking"); setHeard(text);
            const yes = /\b(yes|yeah|yep|do it|go ahead|confirm|sure)\b/i.test(text);
            const no = /\b(no|nope|cancel|stop|never mind)\b/i.test(text);
            if (pendingConfirmRef.current && no) { pendingConfirmRef.current = false; void speak("Okay, leaving it as is."); return; }
            void respond(text, pendingConfirmRef.current && yes);
          }
        } else if (piece) setHeard(fixName((finalRef.current + " " + piece).trim()));
      } catch { /* ignore */ }
    };
    ws.onclose = () => { if (wsRef.current === ws && activeRef.current && state === "listening") setError("Live speech closed."); };
  }, [respond, speak, stopMic, state]);

  const open = useCallback(() => { activeRef.current = true; setActive(true); void listen(); }, [listen]);
  const close = useCallback(() => { activeRef.current = false; setActive(false); stopMic(); audioRef.current?.pause(); setState("idle"); }, [stopMic]);
  const interrupt = useCallback(() => { audioRef.current?.pause(); audioRef.current = null; void listen(); }, [listen]);
  const toggleMute = useCallback(() => { mutedRef.current = !mutedRef.current; setMuted(mutedRef.current); }, []);

  useEffect(() => () => { activeRef.current = false; stopMic(); }, [stopMic]);

  return { active, state, heard, said, muted, level, error, open, close, interrupt, toggleMute };
}

export const AERA_VOICES = [
  { id: "aura-2-thalia-en", name: "Thalia", note: "Clear, confident, warm. The default." },
  { id: "aura-2-athena-en", name: "Athena", note: "Calm and measured, a little lower." },
  { id: "aura-2-luna-en", name: "Luna", note: "Soft, poetic, unhurried." },
  { id: "aura-2-asteria-en", name: "Asteria", note: "Bright and energetic." },
  { id: "aura-2-hera-en", name: "Hera", note: "Mature, authoritative." },
  { id: "aura-2-orion-en", name: "Orion", note: "Male. Smooth and grounded." },
  { id: "aura-2-arcas-en", name: "Arcas", note: "Male. Natural, conversational." },
];
