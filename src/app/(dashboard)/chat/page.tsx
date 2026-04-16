"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Volume2, VolumeX, Radio, ArrowUp } from "lucide-react";
import { AGENTS, AGENT_DISPLAY_ORDER, hexToRgb } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";
import { useAERA } from "@/context/AERAContext";
import { useClientMemory } from "@/context/ClientMemory";
import { AERAOrb } from "@/components/chat/AERAOrb";
import { VoiceWave, IdleWave } from "@/components/chat/VoiceWave";
import { ThinkingDots } from "@/components/chat/ThinkingDots";
import { ApexMark } from "@/components/chat/ApexMark";
import { ThinkingBubble } from "@/components/chat/ThinkingBubble";
import { ThreadSidebar } from "@/components/chat/ThreadSidebar";
import { useDeepgramSTT } from "@/hooks/useDeepgramSTT";
import { useAudioVisualizer, useSpeechToText } from "@/hooks/useVoice";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TTS_SPEEDS, type TTSSpeed } from "@/hooks/useElevenLabsTTS";
import { useSoundFX } from "@/hooks/useSoundFX";
import AERAChart from "@/components/chat/AERAChart";

// ── Local transcript cleanup (voice mode) ────────────────────
// Instant, synchronous — no API round-trip.
// Deepgram smart_format + punctuate already handles 95% of it;
// this just covers capitalisation and terminal punctuation edge cases.
// Saves 500-1000ms per utterance vs. the polish API.
function localCleanup(text: string): string {
  if (!text) return text;
  let t = text.trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  t = t.replace(/\bi\b/g, "I");
  if (t && !/[.!?]$/.test(t)) t += ".";
  return t;
}

// ── Transcript polish (text-mode dictation only) ─────────────
// Routes raw STT text through /api/voice/polish (claude-haiku-4-5) for
// richer punctuation, capitalization, and grammar restoration.
// NOT used in voice mode — adds 500-1000ms latency per utterance.
async function polishText(text: string): Promise<string> {
  if (!text) return text;
  try {
    const res = await fetch("/api/voice/polish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`polish ${res.status}`);
    const data = await res.json() as { text: string };
    return data.text || text;
  } catch {
    return localCleanup(text);
  }
}

export default function ChatPage() {
  const {
    messages, addUserMessage, isTyping, togglePanel,
    isSpeaking, speakingMessageId, speak, stopSpeaking,
    unlockAudio, ttsSpeed, setTtsSpeed,
    voiceMode, toggleVoiceMode,
  } = useAERA();
  const { memory, resetMemory, setSelectedAgent } = useClientMemory();
  const selectedAgentId = memory.selectedAgentId;
  const { send: sfxSend, receive: sfxReceive } = useSoundFX();

  const [input,       setInput]       = useState("");
  const [interimText, setInterimText] = useState("");
  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef     = useRef<HTMLTextAreaElement>(null);

  const { bars, amplitude, start: startViz, stop: stopViz } = useAudioVisualizer();
  const vizActiveRef = useRef(false);

  // ── Smart transcription (Grok-like) ─────────────────────────
  // While speaking: show ONLY the waveform — no raw interim text.
  // Deepgram's smart_format+punctuate gives clean, finalized text.
  // When auto-send fires: briefly display the clean finalized text in
  // the waveform label for 500 ms so the user sees what was transcribed,
  // then send it. This feels intentional and premium — not raw/robotic.
  const [finalizedText, setFinalizedText] = useState("");

  // ── Stable refs for use inside async callbacks ───────────────
  // isSpeakingRef lets onAutoSend detect mid-TTS interrupts without
  // capturing stale closure values.
  const isSpeakingRef = useRef(isSpeaking);
  const voiceModeRef  = useRef(voiceMode);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { voiceModeRef.current  = voiceMode;  }, [voiceMode]);

  const { isListening: vcListening, isConnecting: vcConnecting, isMuted: vcMuted, start: vcStart, stop: vcStop, toggleMute: vcToggleMute } = useDeepgramSTT({
    onInterim:  () => {},  // INTENTIONALLY EMPTY — waveform only, no raw interim
    onAutoSend: (text) => {
      // ── ALWAYS-ON MIC: interrupt path ─────────────────────────────
      // If AERA is currently speaking when a transcript arrives, the user
      // spoke over her. Stop TTS immediately and send — no API round-trip.
      if (isSpeakingRef.current) {
        stopSpeaking();
        const clean = localCleanup(text);
        addUserMessage(clean);
        return;
      }
      // Normal voice path: instant local cleanup, show finalized text for
      // 350 ms so the user sees what was transcribed, then send.
      const clean = localCleanup(text);
      setFinalizedText(clean);
      setInterimText("");
      setInput("");
      setTimeout(() => { setFinalizedText(""); addUserMessage(clean); }, 350);
    },
  });

  // Simple dictation mic — only active in text mode
  const { isListening: simpleListening, toggle: _simpleMicToggleRaw } = useSpeechToText((text) => {
    polishText(text).then((clean) => {
      setInput((prev) => (prev ? prev + " " + clean : clean));
    });
  });

  // Wrap toggle so the audio visualizer also starts/stops with dictation
  const simpleMicToggle = () => {
    if (simpleListening) {
      _simpleMicToggleRaw();
      stopViz(); vizActiveRef.current = false;
    } else {
      _simpleMicToggleRaw();
      if (!vizActiveRef.current) { vizActiveRef.current = true; startViz(); }
    }
  };

  // Orb state — four distinct modes:
  // speaking → smooth vocal wave (AERA delivering audio)
  // thinking → rapid energetic pulse (AERA processing / generating)
  // listening → calm visible breath (mic open, user speaking)
  // idle     → meditative slow breath (standby)
  const orbState = isSpeaking
    ? "speaking" as const
    : isTyping
      ? "thinking" as const
      : vcListening
        ? "listening" as const
        : "idle" as const;

  // ── Scroll to bottom ─────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // ── Sound FX on AERA response complete ───────────────────────
  const wasTypingRef = useRef(false);
  useEffect(() => {
    if (wasTypingRef.current && !isTyping) {
      sfxReceive(); // chime when AERA finishes generating
    }
    wasTypingRef.current = isTyping;
  }, [isTyping, sfxReceive]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = (voiceMode ? finalizedText : input).trim() || input.trim();
    if (!trimmed) return;
    sfxSend(); // chirp on send
    if (voiceMode) {
      setFinalizedText("");
      setInterimText("");
    }
    addUserMessage(trimmed);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSpeak = (text: string, id: string, agentId?: AgentId) => {
    if (speakingMessageId === id) stopSpeaking();
    else {
      const voiceId = agentId ? AGENTS[agentId]?.voice_id : undefined;
      speak(text, id, voiceId);
    }
  };

  const handleToggleVoiceMode = () => {
    if (voiceMode) {
      vcStop(); stopViz(); vizActiveRef.current = false;
      setInterimText(""); stopSpeaking(); toggleVoiceMode();
    } else {
      // Unlock AudioContext here — we're inside a user gesture, so the
      // browser grants autoplay permission for all future async audio playback.
      unlockAudio();
      toggleVoiceMode();
      vcStart();
      if (!vizActiveRef.current) { vizActiveRef.current = true; startViz(); }
    }
  };

  // ── Tap-to-interrupt — click the waveform strip to stop AERA ──
  // Voice interrupt now also works automatically: the mic is always on,
  // so speaking over AERA fires onAutoSend which calls stopSpeaking()
  // before sending. This handler is the manual tap fallback.
  const handleInterrupt = () => {
    stopSpeaking();
  };

  // Status label for orb sidebar
  const statusLabel = isSpeaking
    ? "Speaking…"
    : vcMuted
      ? "Muted"
      : vcListening
        ? "Listening…"
        : vcConnecting
          ? "Connecting…"
          : isTyping
            ? "Thinking…"
            : voiceMode
              ? "Voice · Ready"
              : "Intelligence Layer";

  // Waveform strip label — show finalized text (clean, Grok-style) briefly, otherwise status
  const waveLabel = finalizedText
    ? finalizedText
    : vcMuted
      ? "Muted — tap to unmute"
      : vcConnecting
        ? "Connecting — just a moment…"
        : vcListening
          ? "Listening — speak naturally"
          : isSpeaking
            ? "Tap to interrupt AERA"
            : isTyping
              ? "AERA is thinking…"
              : "Ready — speak to begin";

  const hasText = input.trim().length > 0 || finalizedText.trim().length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", padding: "clamp(16px, 2.5vw, 40px)" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 24, flexShrink: 0 }}>
        <div>
          <p className="label-eyebrow mb-3">AI Brand Companion</p>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>
            AERA Intelligence
          </h2>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>

          {/* ── Mute toggle — only visible in voice mode ── */}
          {voiceMode && (
            <button
              onClick={vcToggleMute}
              title={vcMuted ? "Unmute microphone" : "Mute microphone"}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 18px", borderRadius: 11,
                border: vcMuted ? "1px solid rgba(245,158,11,0.55)" : "1px solid var(--border)",
                background: vcMuted ? "rgba(245,158,11,0.10)" : "transparent",
                color: vcMuted ? "#f59e0b" : "var(--text-4)",
                fontSize: 13, fontWeight: 500, letterSpacing: "0.01em", cursor: "pointer",
                transition: "all 0.2s",
                boxShadow: vcMuted ? "0 0 12px rgba(245,158,11,0.15)" : "none",
              }}
            >
              {vcMuted
                ? <MicOff style={{ width: 15, height: 15 }} strokeWidth={1.7} />
                : <Mic style={{ width: 15, height: 15 }} strokeWidth={1.7} />
              }
              <span className="hidden sm:inline">{vcMuted ? "Unmute" : "Mute"}</span>
            </button>
          )}

          {/* ── TTS Speed picker — only in voice mode ── */}
          {voiceMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "3px 4px" }}>
              {(TTS_SPEEDS as TTSSpeed[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setTtsSpeed(s)}
                  title={`Playback speed ${s}×`}
                  style={{
                    fontSize: 10.5, fontWeight: s === ttsSpeed ? 700 : 500,
                    padding: "3px 7px", borderRadius: 7, border: "none",
                    background: s === ttsSpeed ? "rgba(45,212,255,0.15)" : "transparent",
                    color: s === ttsSpeed ? "var(--cyan)" : "var(--text-5)",
                    cursor: "pointer", letterSpacing: "0.01em",
                    transition: "all 0.15s",
                  }}
                >{s}×</button>
              ))}
            </div>
          )}

          {/* Voice Mode and Side Panel removed from header — Voice Mode is now in the chat bar */}
        </div>
      </div>

      {/* ── Main chat area — always dark regardless of theme ── */}
      <div className="force-dark" style={{ flex: 1, display: "flex", borderRadius: 18, border: "1px solid rgba(45,212,255,0.10)", overflow: "hidden", background: "#0a0a0e", boxShadow: "var(--shadow-card)", minHeight: 0 }}>

        {/* ── Left: orb + identity — always dark regardless of theme ── */}
        <div className="hidden md:flex force-dark" style={{ width: 260, minWidth: 260, borderRight: "1px solid rgba(255,255,255,0.05)", flexDirection: "column", alignItems: "center", padding: "22px 16px 16px", background: "#0a0a0c", position: "relative" }}>
          {/* Deep radial glow behind orb */}
          <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(45,212,255,0.07) 0%, transparent 65%)", top: -20, left: "50%", transform: "translateX(-50%)", pointerEvents: "none", zIndex: 1 }} />
          {/* Outer breathing ring */}
          <div className="animate-orb-ring" style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", border: "1px solid rgba(45,212,255,0.08)", top: "38%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 1 }} />
          <div className="animate-orb-ring delay-300" style={{ position: "absolute", width: 240, height: 240, borderRadius: "50%", border: "1px solid rgba(45,212,255,0.04)", top: "38%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 1 }} />

          {/* Content layer — scrollable so all controls are reachable on smaller screens */}
          <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", alignItems: "center", width: "100%", flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>

          <AERAOrb size={148} orbState={orbState} />

          {/* State bar — animated full-width color strip */}
          <div style={{ width: 72, marginTop: 18, marginBottom: 6 }}>
            <div className={`aera-state-bar ${isSpeaking ? "aera-state-bar--speaking" : (vcListening || isTyping) ? "aera-state-bar--active" : "aera-state-bar--idle"}`} />
          </div>

          {/* AERA name — editorial Space Grotesk */}
          <div style={{ textAlign: "center" }}>
            <p className="aera-name-display" style={{ fontSize: 22, color: "#ffffff", lineHeight: 1, letterSpacing: "-0.05em" }}>
              AERA
            </p>
            <p className="aera-label-caps" style={{ color: "rgba(45,212,255,0.50)", marginTop: 6 }}>
              Intelligence Layer
            </p>
          </div>

          {/* Live status chip */}
          <div style={{ marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 13px", borderRadius: 20, background: "rgba(255,255,255,0.03)", border: `1px solid ${(isSpeaking || vcListening) ? "rgba(45,212,255,0.25)" : "rgba(255,255,255,0.06)"}`, transition: "border-color 0.4s" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: isSpeaking ? "#2DD4FF" : vcListening ? "#2DD4FF" : isTyping ? "#F59E0B" : "#22c55e", boxShadow: isSpeaking || vcListening ? "0 0 6px rgba(45,212,255,0.8)" : isTyping ? "0 0 6px rgba(245,158,11,0.7)" : "0 0 5px rgba(34,197,94,0.6)", flexShrink: 0, transition: "all 0.3s" }} />
            <span className="aera-label-caps" style={{ color: (isSpeaking || vcListening) ? "rgba(45,212,255,0.80)" : isTyping ? "rgba(245,158,11,0.80)" : "rgba(255,255,255,0.35)", letterSpacing: "0.12em", transition: "color 0.3s" }}>
              {isSpeaking ? "Speaking" : vcListening ? "Listening" : isTyping ? "Thinking" : voiceMode ? "Voice Ready" : "Active"}
            </span>
          </div>

          {/* ── Thread sidebar ── */}
          {/* minHeight ensures the "New Chat" / "New Folder" buttons are always visible */}
          <div style={{ flex: 1, width: "100%", marginTop: 16, display: "flex", flexDirection: "column", minHeight: "min(120px, 18vh)", flexShrink: 0 }}>
            <ThreadSidebar />
          </div>

          {/* Metrics */}
          <div style={{ width: "100%", marginTop: 14, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
            {/* Label */}
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 2 }}>Campaign Pulse</p>

            {[
              { label: "Messages",    value: messages.length.toString(), icon: "💬" },
              { label: "Brand Score", value: memory.campaignStats.brandScore,       icon: "⭐" },
              { label: "Velocity",    value: memory.campaignStats.velocity,         icon: "🚀" },
            ].map((stat) => (
              <div key={stat.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 9, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 1px 4px rgba(0,0,0,0.20)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, lineHeight: 1 }}>{stat.icon}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--text-4)" }}>{stat.label}</span>
                </div>
                <span suppressHydrationWarning style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)", letterSpacing: "-0.02em", fontFeatureSettings: '"tnum"' }}>{stat.value}</span>
              </div>
            ))}

            {/* ── Voice Profile picker ── */}
            <div style={{ marginTop: 12, flexShrink: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 8 }}>Team</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {AGENT_DISPLAY_ORDER.map((id: AgentId) => {
                  const a = AGENTS[id];
                  const isActive = selectedAgentId === id;
                  function hexToRgb(hex: string): string {
                    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    if (!result) return "45,212,255";
                    return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
                  }
                  return (
                    <button
                      key={id}
                      onClick={() => setSelectedAgent(id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "6px 9px", borderRadius: 8,
                        border: `1px solid ${isActive ? `rgba(${hexToRgb(a.color)}, 0.28)` : "var(--border)"}`,
                        background: isActive ? `rgba(${hexToRgb(a.color)}, 0.07)` : "transparent",
                        cursor: "pointer", width: "100%", textAlign: "left",
                        transition: "all 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = "var(--surface)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: `rgba(${hexToRgb(a.color)}, ${isActive ? "0.14" : "0.07"})`,
                        border: `1px solid rgba(${hexToRgb(a.color)}, 0.18)`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <span style={{ fontSize: 7.5, fontWeight: 800, color: a.color }}>{a.initials}</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 10.5, fontWeight: 600, color: isActive ? a.color : "var(--text-4)", lineHeight: 1, letterSpacing: "-0.01em", transition: "color 0.15s" }}>{a.name}</p>
                        <p style={{ fontSize: 9, color: "var(--text-6)", marginTop: 1.5 }}>{a.role}</p>
                      </div>
                      {isActive && (
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: a.color, boxShadow: `0 0 4px ${a.color}88`, flexShrink: 0 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={() => { resetMemory(); }}
              title="Reset stored memory to defaults"
              style={{ marginTop: 4, width: "100%", padding: "7px 0", borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-5)", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", cursor: "pointer", fontWeight: 500, transition: "all 0.15s" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border-mid)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-5)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              Reset Memory
            </button>
          </div>

          </div>{/* end content layer */}

          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.10), transparent)", zIndex: 3 }} />
        </div>

        {/* ── Mobile orb strip ── */}
        <div className="flex md:hidden items-center gap-3 px-4 py-3 shrink-0 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-deep)", position: "absolute", width: "100%", zIndex: 1 }}>
          <AERAOrb size={36} orbState={orbState} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", lineHeight: 1, letterSpacing: "-0.01em" }}>AERA</p>
            <p style={{ fontSize: 8.5, color: voiceMode ? "var(--cyan)" : "var(--text-6)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2.5 }}>
              {statusLabel}
            </p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: (isSpeaking || vcListening) ? "var(--cyan)" : "#22c55e", boxShadow: (isSpeaking || vcListening) ? "0 0 4px rgba(45,212,255,0.6)" : "0 0 4px rgba(34,197,94,0.5)", transition: "all 0.3s" }} />
            <span suppressHydrationWarning style={{ fontSize: 9.5, color: "var(--text-6)", letterSpacing: "0.04em" }}>{messages.length} msgs</span>
          </div>
        </div>

        {/* ── Right: messages + input ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0, background: "#0d0d10" }}>

          {/* Messages */}
          <div className="pt-[62px] md:pt-0" style={{ flex: 1, overflowY: "auto", padding: "28px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, scale: msg.role === "user" ? 0.84 : 0.94, y: msg.role === "user" ? 6 : 10, x: msg.role === "user" ? 8 : -4 }}
                animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                transition={msg.role === "user"
                  ? { type: "spring", stiffness: 480, damping: 30, mass: 0.8 }
                  : { type: "spring", stiffness: 300, damping: 32, mass: 0.9 }
                }
                style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 13, alignItems: "flex-start" }}
              >
                {/* Agent avatar — shows the specific agent's initials + color */}
                {msg.role === "aera" && (() => {
                  const agent = AGENTS[msg.agentId ?? "aera"];
                  const isTalking = speakingMessageId === msg.id;
                  return (
                    <div style={{ marginTop: 18, flexShrink: 0 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `rgba(${hexToRgb(agent.color)}, ${isTalking ? "0.18" : "0.10"})`,
                        border: `1.5px solid rgba(${hexToRgb(agent.color)}, ${isTalking ? "0.55" : "0.28"})`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isTalking ? `0 0 14px rgba(${hexToRgb(agent.color)}, 0.35)` : "none",
                        transition: "all 0.3s",
                      }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: agent.color, letterSpacing: "-0.01em" }}>
                          {agent.initials}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", gap: 5 }}>

                  {/* Sender label — shows agent name with their accent color */}
                  {msg.role === "aera" ? (() => {
                    const agent = AGENTS[msg.agentId ?? "aera"];
                    return (
                      <p className="msg-sender" style={{ color: `rgba(${hexToRgb(agent.color)}, 0.70)`, paddingLeft: 2 }}>
                        {agent.name.toUpperCase()}
                      </p>
                    );
                  })() : (
                    <p className="msg-sender" style={{ color: "rgba(255,255,255,0.30)", textAlign: "right" }}>
                      You
                    </p>
                  )}

                  {/* Reasoning bubble */}
                  {msg.role === "aera" && msg.thinking && (
                    <ThinkingBubble thinking={msg.thinking} />
                  )}

                  {/* Main bubble */}
                  <div className={msg.role === "aera" ? "aera-bubble" : "user-bubble"}
                    style={{ fontSize: 15, fontWeight: 440, lineHeight: 1.72, color: msg.role === "aera" ? "rgba(255,255,255,0.82)" : "rgba(255,255,255,0.90)", letterSpacing: "-0.007em" }}
                  >
                    {msg.role === "aera" ? (
                      <div className="aera-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>

                  {/* Inline chart */}
                  {msg.role === "aera" && msg.chart && (
                    <AERAChart chart={msg.chart} />
                  )}

                  {/* Hear / stop button */}
                  {msg.role === "aera" && (
                    <button
                      onClick={() => handleSpeak(msg.content, msg.id, msg.agentId)}
                      title={speakingMessageId === msg.id ? "Stop" : "Hear this"}
                      style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, border: "none", background: speakingMessageId === msg.id ? "rgba(45,212,255,0.10)" : "transparent", color: speakingMessageId === msg.id ? "#2DD4FF" : "rgba(255,255,255,0.22)", cursor: "pointer", transition: "all 0.15s", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600 }}
                      onMouseEnter={(e) => { if (speakingMessageId !== msg.id) e.currentTarget.style.color = "rgba(255,255,255,0.50)"; }}
                      onMouseLeave={(e) => { if (speakingMessageId !== msg.id) e.currentTarget.style.color = "rgba(255,255,255,0.22)"; }}
                    >
                      {speakingMessageId === msg.id
                        ? <VolumeX style={{ width: 9, height: 9 }} strokeWidth={1.9} />
                        : <Volume2 style={{ width: 9, height: 9 }} strokeWidth={1.9} />}
                      {speakingMessageId === msg.id ? "Stop" : "Hear"}
                    </button>
                  )}
                </div>
              </motion.div>
            ))}

            {/* Thinking indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6, scale: 0.96 }}
                  transition={{ type: "spring", stiffness: 340, damping: 32 }}
                  style={{ display: "flex", gap: 13, alignItems: "flex-start" }}
                >
                  <div style={{ marginTop: 18, flexShrink: 0 }}>
                    {(() => {
                      const agent = AGENTS[selectedAgentId];
                      return (
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: `rgba(${hexToRgb(agent.color)}, 0.08)`,
                          border: `1.5px solid rgba(${hexToRgb(agent.color)}, 0.22)`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          animation: "breathe 1.6s ease-in-out infinite",
                        }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: agent.color, opacity: 0.7 }}>
                            {agent.initials}
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <p className="msg-sender" style={{ color: `rgba(${hexToRgb(AGENTS[selectedAgentId].color)}, 0.55)` }}>
                      {AGENTS[selectedAgentId].name.toUpperCase()}
                    </p>
                    <div className="thinking-shimmer" style={{
                      padding: "14px 20px",
                      borderRadius: "3px 18px 18px 18px",
                      border: "1px solid rgba(45,212,255,0.12)",
                      display: "flex", alignItems: "center", gap: 12,
                    }}>
                      <ThinkingDots size={4} gap={3.5} />
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.40)", letterSpacing: "0.06em", fontWeight: 500 }}>
                        Processing…
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input area ── */}
          <div style={{ padding: "10px 20px 18px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "#0d0d0f" }}>

            {/* ── Simple dictation mic waveform ── */}
            <AnimatePresence>
              {simpleListening && !voiceMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  style={{
                    marginBottom: 8,
                    borderRadius: 10,
                    border: "1px solid rgba(45,212,255,0.30)",
                    background: "rgba(45,212,255,0.04)",
                    padding: "8px 14px 6px",
                    overflow: "hidden",
                  }}
                >
                  <VoiceWave bars={bars} amplitude={amplitude} height={28} />
                  <p style={{ fontSize: 9.5, color: "var(--text-6)", marginTop: 5, textAlign: "center", letterSpacing: "0.07em", textTransform: "uppercase" }}>
                    Dictating — speak naturally
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Voice mode waveform strip ── */}
            <AnimatePresence>
              {voiceMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  onClick={vcMuted ? vcToggleMute : isSpeaking ? handleInterrupt : undefined}
                  style={{
                    marginBottom: 10,
                    borderRadius: 12,
                    border: vcMuted
                      ? "1px solid rgba(245,158,11,0.40)"
                      : isSpeaking
                        ? "1px solid rgba(45,212,255,0.50)"
                        : vcListening
                          ? "1px solid rgba(45,212,255,0.35)"
                          : "1px solid var(--border)",
                    background: vcMuted
                      ? "rgba(245,158,11,0.05)"
                      : vcListening
                        ? "rgba(45,212,255,0.05)"
                        : "var(--surface-2)",
                    padding: "12px 18px 10px",
                    transition: "border-color 0.3s, background 0.3s",
                    overflow: "hidden",
                    cursor: (vcMuted || isSpeaking) ? "pointer" : "default",
                  }}
                >
                  {(!vcMuted && vcListening)
                    ? <VoiceWave bars={bars} amplitude={amplitude} height={44} />
                    : <IdleWave height={44} />
                  }
                  {isTyping ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 8 }}>
                      <ThinkingDots size={4} gap={3} />
                      <span style={{ fontSize: 10, color: "var(--cyan)", letterSpacing: "0.07em", textTransform: "uppercase", fontWeight: 600, opacity: 0.85 }}>
                        Thinking…
                      </span>
                    </div>
                  ) : (
                    <p style={{
                      fontSize: finalizedText ? 13 : 10,
                      color: finalizedText ? "var(--text-2)" : "var(--text-6)",
                      marginTop: 8,
                      textAlign: "center",
                      letterSpacing: finalizedText ? "-0.005em" : "0.07em",
                      textTransform: finalizedText ? "none" : "uppercase",
                      lineHeight: 1.45,
                      fontWeight: finalizedText ? 400 : 500,
                      transition: "all 0.2s",
                    }}>
                      {waveLabel}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Text input — floating glass pod with animated gradient ring ── */}
            <div className="input-glow-ring" style={{
              display: "flex", gap: 0, alignItems: "flex-end",
              background: "rgba(255,255,255,0.025)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 24,
              padding: "10px 10px 10px 22px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}>
              <textarea
                ref={textareaRef}
                value={voiceMode ? (finalizedText || input) : input}
                onChange={voiceMode ? undefined : (e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                }}
                readOnly={voiceMode}
                onKeyDown={voiceMode ? undefined : handleKeyDown}
                rows={1}
                placeholder={voiceMode ? (vcListening ? "Speak now…" : "Voice mode active") : "Ask AERA anything…"}
                style={{ flex: 1, resize: "none", background: "transparent", border: "none", outline: "none", fontSize: 14.5, color: "rgba(255,255,255,0.88)", lineHeight: 1.60, padding: "4px 0", minHeight: 28, maxHeight: 140, fontFamily: "inherit", letterSpacing: "-0.005em", cursor: voiceMode ? "default" : "text" }}
              />

              <div style={{ display: "flex", gap: 7, alignItems: "flex-end", padding: "0 0 2px 12px", flexShrink: 0 }}>

                {/* Dictation mic (text mode) / Mute toggle (voice mode) */}
                {voiceMode ? (
                  <motion.button
                    onClick={vcToggleMute}
                    title={vcMuted ? "Unmute microphone" : "Mute microphone"}
                    whileTap={{ scale: 0.86 }}
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: vcMuted ? "rgba(245,158,11,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${vcMuted ? "rgba(245,158,11,0.40)" : "rgba(255,255,255,0.08)"}`,
                      color: vcMuted ? "#f59e0b" : "rgba(255,255,255,0.40)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all 0.18s",
                      boxShadow: vcMuted ? "0 0 16px rgba(245,158,11,0.22)" : "none",
                    }}
                  >
                    {vcMuted
                      ? <MicOff style={{ width: 15, height: 15 }} strokeWidth={1.7} />
                      : <Mic style={{ width: 15, height: 15 }} strokeWidth={1.7} />}
                  </motion.button>
                ) : (
                  <motion.button
                    onClick={simpleMicToggle}
                    title={simpleListening ? "Stop dictation" : "Dictate"}
                    whileTap={{ scale: 0.86 }}
                    style={{
                      width: 40, height: 40, borderRadius: "50%",
                      background: simpleListening ? "rgba(45,212,255,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${simpleListening ? "rgba(45,212,255,0.40)" : "rgba(255,255,255,0.08)"}`,
                      color: simpleListening ? "#2DD4FF" : "rgba(255,255,255,0.40)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all 0.18s",
                      boxShadow: simpleListening ? "0 0 16px rgba(45,212,255,0.25)" : "none",
                    }}
                    onMouseEnter={(e) => { if (!simpleListening) { e.currentTarget.style.color = "rgba(255,255,255,0.70)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; } }}
                    onMouseLeave={(e) => { if (!simpleListening) { e.currentTarget.style.color = "rgba(255,255,255,0.40)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; } }}
                  >
                    {simpleListening
                      ? <MicOff style={{ width: 15, height: 15 }} strokeWidth={1.7} />
                      : <Mic style={{ width: 15, height: 15 }} strokeWidth={1.7} />}
                  </motion.button>
                )}

                {/* Voice Mode toggle — always in the bar */}
                <motion.button
                  onClick={handleToggleVoiceMode}
                  title={voiceMode ? "Exit voice mode" : "Start voice mode"}
                  whileTap={{ scale: 0.86 }}
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: voiceMode ? "rgba(45,212,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${voiceMode ? "rgba(45,212,255,0.40)" : "rgba(255,255,255,0.08)"}`,
                    color: voiceMode ? "#2DD4FF" : "rgba(255,255,255,0.40)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.18s",
                    boxShadow: voiceMode ? "0 0 16px rgba(45,212,255,0.25)" : "none",
                    position: "relative",
                  }}
                  onMouseEnter={(e) => { if (!voiceMode) { e.currentTarget.style.color = "rgba(255,255,255,0.70)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.16)"; } }}
                  onMouseLeave={(e) => { if (!voiceMode) { e.currentTarget.style.color = "rgba(255,255,255,0.40)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; } }}
                >
                  <Radio style={{ width: 15, height: 15 }} strokeWidth={1.7} />
                  {/* Live indicator dot when voice mode active */}
                  {voiceMode && (
                    <span style={{
                      position: "absolute", top: 7, right: 7,
                      width: 5, height: 5, borderRadius: "50%",
                      background: vcMuted ? "#f59e0b" : vcListening ? "#2DD4FF" : "rgba(45,212,255,0.5)",
                      boxShadow: vcListening ? "0 0 4px rgba(45,212,255,0.8)" : "none",
                      transition: "all 0.2s",
                    }} />
                  )}
                </motion.button>

                {/* Send button */}
                <motion.button
                  onClick={handleSend}
                  disabled={!hasText}
                  whileTap={hasText ? { scale: 0.86 } : {}}
                  style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: hasText
                      ? "linear-gradient(140deg, #2DD4FF 0%, #00C4E8 55%, #0099B8 100%)"
                      : "rgba(255,255,255,0.05)",
                    border: hasText ? "none" : "1px solid rgba(255,255,255,0.07)",
                    color: hasText ? "#00080f" : "rgba(255,255,255,0.22)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: hasText ? "pointer" : "default",
                    transition: "all 0.22s",
                    boxShadow: hasText
                      ? "0 0 22px rgba(45,212,255,0.50), 0 4px 12px rgba(0,0,0,0.35)"
                      : "none",
                  }}
                >
                  <ArrowUp style={{ width: 17, height: 17 }} strokeWidth={2.6} />
                </motion.button>
              </div>
            </div>

            <p className="aera-label-caps" style={{ color: "rgba(255,255,255,0.18)", textAlign: "center", marginTop: 10, letterSpacing: "0.10em" }}>
              {voiceMode ? "Voice · AERA listens and replies aloud" : "APEX Intelligence · All responses preserve brand standards"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
