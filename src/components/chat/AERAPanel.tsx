"use client";

/**
 * AERAPanel — Compact Quick Ask side panel.
 *
 * This is NOT a chat clone. Design intent:
 * - Purpose: 10-second queries while navigating any dashboard page
 * - Shows last 3 messages (shared context with the full chat)
 * - Page-aware context brief (key metrics relevant to current page)
 * - Single-line quick-ask input with mic + send
 * - "Open full conversation →" for deep work
 *
 * Full chat lives at /chat. This panel is the CliffsNotes entry point.
 */

import { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUpRight, Radio, Volume2, VolumeX, Mic, MicOff, ChevronRight } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAERA } from "@/context/AERAContext";
import { useClientMemory } from "@/context/ClientMemory";
import { AERAOrb } from "./AERAOrb";
import { ApexMark } from "./ApexMark";
import { ThinkingDots } from "./ThinkingDots";
import { ThinkingBubble } from "./ThinkingBubble";
import { VoiceWave, IdleWave } from "./VoiceWave";
import { useDeepgramSTT } from "@/hooks/useDeepgramSTT";
import { useAudioVisualizer } from "@/hooks/useVoice";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AERAChart from "./AERAChart";

// ── Mobile detection ───────────────────────────────────────────────
function useIsMobile() {
  const [is, setIs] = useState(false);
  useEffect(() => {
    const check = () => setIs(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return is;
}

// ── Voice cleanup ──────────────────────────────────────────────────
function localCleanup(text: string): string {
  if (!text) return text;
  let t = text.trim();
  t = t.charAt(0).toUpperCase() + t.slice(1);
  t = t.replace(/\bi\b/g, "I");
  if (!/[.!?]$/.test(t)) t += ".";
  return t;
}

// ── Page-aware context brief data ─────────────────────────────────
type ContextItem = { label: string; value: string; color?: string };
function useContextBrief(pathname: string, stats: ReturnType<typeof useClientMemory>["memory"]["campaignStats"]): { heading: string; items: ContextItem[] } {
  if (pathname.startsWith("/campaigns")) return {
    heading: "Campaign Health",
    items: [
      { label: "Velocity",    value: stats.velocity,     color: "#2DD4FF" },
      { label: "Brand Score", value: stats.brandScore,   color: "#22C55E" },
      { label: "Open Rate",   value: stats.openRate,     color: "#818CF8" },
    ],
  };
  if (pathname.startsWith("/account")) return {
    heading: "Account Overview",
    items: [
      { label: "Quarter",     value: "Q2 2026",          color: "#2DD4FF" },
      { label: "CPA",         value: stats.cpa,          color: "#F59E0B" },
      { label: "SEO Lift",    value: stats.seoLift,      color: "#22C55E" },
    ],
  };
  // Default: Dashboard / other pages
  return {
    heading: "Campaign Pulse",
    items: [
      { label: "ROAS",        value: stats.roas,         color: "#2DD4FF" },
      { label: "Velocity",    value: stats.velocity,     color: "#22C55E" },
      { label: "Brand Score", value: stats.brandScore,   color: "#818CF8" },
    ],
  };
}

// ── Component ──────────────────────────────────────────────────────
export function AERAPanel() {
  const {
    isOpen, closePanel,
    messages, addUserMessage,
    isTyping, isSpeaking, speakingMessageId, speak, stopSpeaking,
    unlockAudio, voiceMode, toggleVoiceMode,
  } = useAERA();

  const { memory } = useClientMemory();
  const pathname   = usePathname();
  const isMobile   = useIsMobile();
  const contextBrief = useContextBrief(pathname ?? "/", memory.campaignStats);

  const [input, setInput]               = useState("");
  const [finalizedText, setFinalizedText] = useState("");
  const inputRef    = useRef<HTMLInputElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  const isSpeakingRef = useRef(isSpeaking);
  const voiceModeRef  = useRef(voiceMode);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { voiceModeRef.current  = voiceMode;  }, [voiceMode]);

  // ── Voice / STT ────────────────────────────────────────────────
  const { bars, amplitude, start: startViz, stop: stopViz } = useAudioVisualizer();
  const vizRef = useRef(false);

  const { isListening, isConnecting, isMuted, start: vcStart, stop: vcStop, toggleMute: vcToggleMute } = useDeepgramSTT({
    onInterim: () => {},
    onAutoSend: useCallback((text: string) => {
      if (isSpeakingRef.current) { stopSpeaking(); addUserMessage(localCleanup(text)); return; }
      const clean = localCleanup(text);
      setFinalizedText(clean);
      setInput("");
      setTimeout(() => { setFinalizedText(""); addUserMessage(clean); }, 350);
    }, [addUserMessage, stopSpeaking]),
  });

  // Cleanup when panel closes
  useEffect(() => {
    if (!isOpen) { vcStop(); stopViz(); vizRef.current = false; setFinalizedText(""); }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to latest
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && !voiceMode) setTimeout(() => inputRef.current?.focus(), 350);
  }, [isOpen, voiceMode]);

  // ── Handlers ──────────────────────────────────────────────────
  const handleSend = () => {
    const text = (voiceMode ? finalizedText : input).trim() || input.trim();
    if (!text) return;
    addUserMessage(text);
    setInput(""); setFinalizedText("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleSend(); }
  };

  const handleVoiceToggle = () => {
    if (voiceMode) {
      vcStop(); stopViz(); vizRef.current = false; stopSpeaking(); setFinalizedText(""); toggleVoiceMode();
    } else {
      unlockAudio(); toggleVoiceMode(); vcStart();
      if (!vizRef.current) { vizRef.current = true; startViz(); }
    }
  };

  // ── Derived state ──────────────────────────────────────────────
  const orbState = isSpeaking ? "speaking" as const : isTyping ? "thinking" as const : isListening ? "listening" as const : "idle" as const;

  // Show last 3 messages (non-greeting) for context
  const recentMessages = messages.slice(-4);
  const hiddenCount    = Math.max(0, messages.length - 4);

  // ── Animation variants ─────────────────────────────────────────
  const slideVariants = isMobile
    ? { initial: { y: "100%", opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: "100%", opacity: 0 } }
    : { initial: { x: 400, opacity: 0 },    animate: { x: 0, opacity: 1 }, exit: { x: 400, opacity: 0 }    };

  const panelStyle: React.CSSProperties = isMobile
    ? { position: "fixed", inset: 0, top: "auto", height: "90vh", zIndex: 60, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(10,10,14,0.97)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 60px rgba(0,0,0,0.65)", borderTop: "1px solid rgba(45,212,255,0.12)" }
    : { width: 360, minWidth: 360, maxWidth: 360, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(10,10,14,0.97)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)", borderLeft: "1px solid rgba(45,212,255,0.13)", boxShadow: "-32px 0 80px rgba(0,0,0,0.35), -1px 0 0 rgba(45,212,255,0.05)", position: "relative", zIndex: 20 };

  const statusText = isSpeaking ? "Speaking…" : isMuted ? "Muted" : isListening ? "Listening…" : isConnecting ? "Connecting…" : isTyping ? "Thinking…" : voiceMode ? "Voice · Ready" : "Active";

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile only) */}
          {isMobile && (
            <motion.div
              key="panel-bd"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel}
              style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(3px)" }}
            />
          )}

          <motion.aside
            key="quick-ask-panel"
            initial={slideVariants.initial}
            animate={slideVariants.animate}
            exit={slideVariants.exit}
            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
            style={panelStyle}
          >
            {/* Top cyan accent line */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.5), transparent)", zIndex: 2 }} />

            {/* Left-edge gradient veil — softens the hard contrast cut against light dashboard */}
            <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 32, background: "linear-gradient(90deg, rgba(10,10,14,0.55) 0%, transparent 100%)", pointerEvents: "none", zIndex: 1 }} />

            {/* ── Header ──────────────────────────────────────────── */}
            <div style={{ padding: "14px 16px 12px", display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.05)" }}>

              {/* Mini orb */}
              <div style={{ flexShrink: 0 }}>
                <AERAOrb size={42} orbState={orbState} />
              </div>

              {/* Identity + status */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1 }}>AERA</span>
                  <span style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", color: "rgba(45,212,255,0.55)", background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.14)", borderRadius: 4, padding: "1.5px 5px" }}>
                    QUICK ASK
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                    background: (isSpeaking || isListening) ? "#2DD4FF" : isMuted ? "#F59E0B" : "#22C55E",
                    boxShadow: (isSpeaking || isListening) ? "0 0 5px rgba(45,212,255,0.8)" : undefined,
                    transition: "all 0.3s",
                  }} />
                  <span style={{ fontSize: 10, color: voiceMode ? "#2DD4FF" : "rgba(255,255,255,0.35)", letterSpacing: "0.05em", transition: "color 0.3s" }}>
                    {statusText}
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>

                {/* Voice toggle */}
                <button
                  onClick={handleVoiceToggle}
                  title={voiceMode ? "Exit voice mode" : "Enter voice mode"}
                  style={{
                    width: 28, height: 28, borderRadius: 7,
                    border: voiceMode ? "1px solid rgba(45,212,255,0.40)" : "1px solid rgba(255,255,255,0.08)",
                    background: voiceMode ? "rgba(45,212,255,0.10)" : "transparent",
                    color: voiceMode ? "#2DD4FF" : "rgba(255,255,255,0.35)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                >
                  <Radio style={{ width: 12, height: 12 }} strokeWidth={1.8} />
                </button>

                {/* Mute (voice mode only) */}
                {voiceMode && (
                  <button
                    onClick={vcToggleMute}
                    style={{
                      width: 28, height: 28, borderRadius: 7,
                      border: isMuted ? "1px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.08)",
                      background: isMuted ? "rgba(245,158,11,0.10)" : "transparent",
                      color: isMuted ? "#F59E0B" : "rgba(255,255,255,0.35)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                  >
                    {isMuted ? <MicOff style={{ width: 12, height: 12 }} strokeWidth={1.8} /> : <Mic style={{ width: 12, height: 12 }} strokeWidth={1.8} />}
                  </button>
                )}

                {/* Open full chat */}
                <Link href="/chat" onClick={closePanel}>
                  <button
                    title="Open full AERA conversation"
                    style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    <ArrowUpRight style={{ width: 12, height: 12 }} strokeWidth={1.8} />
                  </button>
                </Link>

                {/* Close */}
                <button
                  onClick={closePanel}
                  style={{ width: 28, height: 28, borderRadius: 7, border: "1px solid rgba(255,255,255,0.08)", background: "transparent", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.18s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.20)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                >
                  <X style={{ width: 12, height: 12 }} strokeWidth={1.8} />
                </button>
              </div>
            </div>

            {/* ── Context brief ────────────────────────────────────── */}
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
              <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)", marginBottom: 8 }}>
                {contextBrief.heading}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {contextBrief.items.map((item) => (
                  <div
                    key={item.label}
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 9, padding: "8px 10px", textAlign: "center" }}
                  >
                    <p suppressHydrationWarning style={{ fontSize: 14, fontWeight: 700, color: item.color ?? "#2DD4FF", letterSpacing: "-0.03em", lineHeight: 1, fontFeatureSettings: '"tnum"' }}>{item.value}</p>
                    <p style={{ fontSize: 9, color: "rgba(255,255,255,0.30)", letterSpacing: "0.05em", marginTop: 4, textTransform: "uppercase" }}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recent conversation ──────────────────────────────── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

              {/* "N earlier messages" link */}
              {hiddenCount > 0 && (
                <Link href="/chat" onClick={closePanel}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, padding: "6px 10px", borderRadius: 8, background: "rgba(45,212,255,0.04)", border: "1px solid rgba(45,212,255,0.10)", cursor: "pointer", marginBottom: 2 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(45,212,255,0.08)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(45,212,255,0.04)"; }}
                  >
                    <span style={{ fontSize: 10.5, color: "rgba(45,212,255,0.65)", fontWeight: 500 }}>
                      {hiddenCount} earlier message{hiddenCount !== 1 ? "s" : ""}
                    </span>
                    <ChevronRight style={{ width: 10, height: 10, color: "rgba(45,212,255,0.50)" }} strokeWidth={2} />
                  </div>
                </Link>
              )}

              {/* Message list */}
              {recentMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ display: "flex", flexDirection: msg.role === "user" ? "row-reverse" : "row", gap: 8, alignItems: "flex-start" }}
                >
                  {/* Avatar */}
                  <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: msg.role === "aera" ? "rgba(45,212,255,0.08)" : "rgba(255,255,255,0.05)", border: `1px solid ${msg.role === "aera" ? "rgba(45,212,255,0.20)" : "rgba(255,255,255,0.10)"}` }}>
                    {msg.role === "aera"
                      ? <ApexMark size={10} glow />
                      : <span style={{ fontSize: 7.5, fontWeight: 700, color: "rgba(255,255,255,0.40)" }}>I</span>
                    }
                  </div>

                  {/* Bubble */}
                  <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 3 }}>

                    {/* Reasoning bubble (compact) */}
                    {msg.role === "aera" && msg.thinking && (
                      <ThinkingBubble thinking={msg.thinking} compact />
                    )}

                    <div style={{
                      padding: "8px 11px",
                      borderRadius: msg.role === "aera" ? "3px 11px 11px 11px" : "11px 3px 11px 11px",
                      background: msg.role === "aera" ? "rgba(255,255,255,0.05)" : "rgba(45,212,255,0.09)",
                      border: `1px solid ${msg.role === "aera" ? "rgba(255,255,255,0.07)" : "rgba(45,212,255,0.18)"}`,
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: msg.role === "aera" ? "rgba(255,255,255,0.78)" : "rgba(255,255,255,0.90)",
                      letterSpacing: "-0.003em",
                    }}>
                      {msg.role === "aera" ? (
                        <div className="aera-markdown" style={{ fontSize: 12.5 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.content}
                    </div>

                    {/* Inline chart (compact) */}
                    {msg.role === "aera" && msg.chart && (
                      <AERAChart chart={msg.chart} />
                    )}

                    {/* Hear button */}
                    {msg.role === "aera" && (
                      <button
                        onClick={() => speakingMessageId === msg.id ? stopSpeaking() : speak(msg.content, msg.id)}
                        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 4, padding: "2px 5px", borderRadius: 4, border: "none", background: "transparent", color: speakingMessageId === msg.id ? "#2DD4FF" : "rgba(255,255,255,0.22)", cursor: "pointer", fontSize: 8.5, letterSpacing: "0.06em", textTransform: "uppercase", transition: "color 0.15s" }}
                        onMouseEnter={(e) => { if (speakingMessageId !== msg.id) e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
                        onMouseLeave={(e) => { if (speakingMessageId !== msg.id) e.currentTarget.style.color = "rgba(255,255,255,0.22)"; }}
                      >
                        {speakingMessageId === msg.id
                          ? <VolumeX style={{ width: 8, height: 8 }} strokeWidth={1.8} />
                          : <Volume2 style={{ width: 8, height: 8 }} strokeWidth={1.8} />
                        }
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
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.20)" }}>
                      <ApexMark size={10} glow />
                    </div>
                    <div style={{ padding: "7px 12px", borderRadius: "3px 10px 10px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 7 }}>
                      <ThinkingDots size={3} gap={3} />
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.04em" }}>Thinking…</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={bottomRef} />
            </div>

            {/* ── Voice strip (voice mode only) ────────────────────── */}
            <AnimatePresence>
              {voiceMode && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  onClick={isMuted ? vcToggleMute : isSpeaking ? stopSpeaking : undefined}
                  style={{
                    margin: "0 14px",
                    borderRadius: 10,
                    border: isMuted ? "1px solid rgba(245,158,11,0.35)" : isListening ? "1px solid rgba(45,212,255,0.30)" : "1px solid rgba(255,255,255,0.06)",
                    background: isMuted ? "rgba(245,158,11,0.05)" : isListening ? "rgba(45,212,255,0.04)" : "rgba(255,255,255,0.02)",
                    padding: "8px 12px",
                    overflow: "hidden",
                    cursor: (isMuted || isSpeaking) ? "pointer" : "default",
                    flexShrink: 0,
                    marginBottom: 8,
                    transition: "border-color 0.3s",
                  }}
                >
                  {!isMuted && isListening
                    ? <VoiceWave bars={bars} amplitude={amplitude} height={28} compact />
                    : <IdleWave height={28} compact />
                  }
                  <p style={{ fontSize: 9, textAlign: "center", marginTop: 5, letterSpacing: "0.07em", textTransform: "uppercase", color: isMuted ? "#F59E0B" : isTyping ? "#2DD4FF" : "rgba(255,255,255,0.25)", fontWeight: isMuted || isTyping ? 600 : 400 }}>
                    {finalizedText || (isMuted ? "Muted — tap to unmute" : isTyping ? "Thinking…" : isSpeaking ? "Tap to interrupt" : isListening ? "Listening…" : "Speak naturally")}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Quick Ask input ──────────────────────────────────── */}
            <div style={{ padding: "8px 14px 14px", flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.05)" }}>

              <div style={{
                display: "flex", alignItems: "center", gap: 0,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${isListening ? "rgba(45,212,255,0.35)" : input ? "rgba(45,212,255,0.18)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 24,
                padding: "8px 8px 8px 16px",
                transition: "border-color 0.2s",
              }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={voiceMode ? (finalizedText || "") : input}
                  onChange={voiceMode ? undefined : (e) => setInput(e.target.value)}
                  onKeyDown={voiceMode ? undefined : handleKey}
                  readOnly={voiceMode}
                  placeholder={isListening ? "Listening…" : voiceMode ? "Speak to AERA…" : "Ask AERA anything…"}
                  style={{
                    flex: 1, border: "none", outline: "none", background: "transparent",
                    fontSize: 13, color: "#fff", fontFamily: "inherit",
                    letterSpacing: "-0.005em",
                    cursor: voiceMode ? "default" : "text",
                  }}
                />

                <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                  {/* Mic */}
                  <button
                    onClick={voiceMode
                      ? (isListening ? () => { vcStop(); stopViz(); vizRef.current = false; } : () => { vcStart(); if (!vizRef.current) { vizRef.current = true; startViz(); } })
                      : handleVoiceToggle
                    }
                    title="Voice"
                    style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: isListening ? "rgba(45,212,255,0.15)" : "transparent",
                      border: isListening ? "1px solid rgba(45,212,255,0.35)" : "none",
                      color: isListening ? "#2DD4FF" : "rgba(255,255,255,0.30)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", transition: "all 0.18s",
                    }}
                    onMouseEnter={(e) => { if (!isListening) e.currentTarget.style.color = "rgba(255,255,255,0.60)"; }}
                    onMouseLeave={(e) => { if (!isListening) e.currentTarget.style.color = "rgba(255,255,255,0.30)"; }}
                  >
                    {isListening
                      ? <MicOff style={{ width: 12, height: 12 }} strokeWidth={1.8} />
                      : <Mic style={{ width: 12, height: 12 }} strokeWidth={1.8} />
                    }
                  </button>

                  {/* Send */}
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() && !finalizedText.trim()}
                    style={{
                      width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: (input.trim() || finalizedText.trim()) ? "linear-gradient(135deg, #2DD4FF, #1AACCC)" : "rgba(255,255,255,0.06)",
                      border: "none",
                      color: (input.trim() || finalizedText.trim()) ? "#000" : "rgba(255,255,255,0.20)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: (input.trim() || finalizedText.trim()) ? "pointer" : "default",
                      transition: "all 0.18s",
                      boxShadow: (input.trim() || finalizedText.trim()) ? "0 0 12px rgba(45,212,255,0.30)" : "none",
                    }}
                  >
                    <ArrowUpRight style={{ width: 13, height: 13 }} strokeWidth={2.2} />
                  </button>
                </div>
              </div>

              {/* Footer CTA */}
              <Link href="/chat" onClick={closePanel}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10, cursor: "pointer", opacity: 0.5, transition: "opacity 0.15s" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.85"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = "0.50"; }}
                >
                  <span style={{ fontSize: 10.5, color: "#2DD4FF", letterSpacing: "0.04em" }}>Open full conversation</span>
                  <ChevronRight style={{ width: 11, height: 11, color: "#2DD4FF" }} strokeWidth={2} />
                </div>
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
