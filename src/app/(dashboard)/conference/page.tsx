"use client";

/**
 * APEX Conference Room
 *
 * Voice + live transcript multi-agent meeting experience.
 * - Always dark — full-page immersive room aesthetic
 * - Sarah (AERA) chairs; specialist agents respond in their own voices
 * - Deepgram STT for user speech
 * - Sequential per-agent TTS: each agent segment is spoken with their ElevenLabs voice
 * - Live transcript with agent name labels and color coding
 */

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { Mic, MicOff, X, Volume2, VolumeX, Users } from "lucide-react";
import { useDeepgramSTT } from "@/hooks/useDeepgramSTT";
import {
  AGENTS, AGENT_DISPLAY_ORDER, parseAgentSegments, hexToRgb,
} from "@/lib/agents";
import type { AgentId, AgentSegment } from "@/lib/agents";

/* ─── Types ─────────────────────────────────────────────────────── */
type TranscriptRole = "user" | AgentId;

interface TranscriptEntry {
  id:        string;
  role:      TranscriptRole;
  text:      string;
  agentId?:  AgentId;         // for non-user entries
  interim?:  boolean;
  timestamp: Date;
}

/* ─── Conference system prompt ───────────────────────────────────── */
const MEETING_CONTEXT = `[CONFERENCE ROOM MODE] You are in an active voice meeting chaired by Sarah (AERA's voice).
The client can hear each agent speak via their individual voice. Keep responses natural for voice —
no bullets, no markdown headers. Each agent contribution should be 1-3 sentences max.
Natural conversational pacing. Sarah opens and closes each exchange.`;

/* ─── Sequential TTS player ─────────────────────────────────────── */
async function fetchAudioBuffer(
  audioCtx: AudioContext,
  text: string,
  voiceId: string,
  signal: AbortSignal,
): Promise<AudioBuffer | null> {
  try {
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_id: voiceId }),
      signal,
    });
    if (!res.ok || signal.aborted) return null;
    const arrayBuffer = await res.arrayBuffer();
    if (signal.aborted) return null;
    return audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch {
    return null;
  }
}

/* ─── Agent presence avatar ────────────────────────────────────── */
function AgentAvatar({
  agentId,
  isSpeaking,
  size = 44,
}: {
  agentId: AgentId;
  isSpeaking: boolean;
  size?: number;
}) {
  const agent = AGENTS[agentId];
  const rgb = hexToRgb(agent.color);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative" }}>
        {/* Speaking ring */}
        {isSpeaking && (
          <div style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            border: `2px solid ${agent.color}`,
            boxShadow: `0 0 16px rgba(${rgb}, 0.5)`,
            animation: "breathe 1.2s ease-in-out infinite",
          }} />
        )}
        <div style={{
          width: size, height: size, borderRadius: "50%",
          background: isSpeaking
            ? `rgba(${rgb}, 0.16)`
            : "rgba(255,255,255,0.04)",
          border: `1.5px solid ${isSpeaking ? agent.color : "rgba(255,255,255,0.10)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.3s",
        }}>
          <span style={{
            fontSize: size * 0.28, fontWeight: 800,
            letterSpacing: "-0.02em",
            color: isSpeaking ? agent.color : "rgba(255,255,255,0.35)",
            transition: "color 0.3s",
          }}>
            {agent.initials}
          </span>
        </div>
        {/* Online dot */}
        <div style={{
          position: "absolute", bottom: 1, right: 1,
          width: 8, height: 8, borderRadius: "50%",
          background: isSpeaking ? agent.color : "#22c55e",
          boxShadow: isSpeaking
            ? `0 0 6px ${agent.color}`
            : "0 0 4px rgba(34,197,94,0.6)",
          border: "1.5px solid #0a0a0e",
          transition: "all 0.3s",
        }} />
      </div>
      <span style={{
        fontSize: 9, fontWeight: 600,
        letterSpacing: "0.06em",
        color: isSpeaking ? agent.color : "rgba(255,255,255,0.35)",
        textTransform: "uppercase",
        transition: "color 0.3s",
      }}>
        {agent.name === "Sarah" ? "Sarah" : agent.name.split(" ")[0]}
      </span>
    </div>
  );
}

/* ─── Transcript message row ─────────────────────────────────────── */
function TranscriptRow({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === "user";

  if (isUser) {
    return (
      <div style={{
        display: "flex", justifyContent: "flex-end",
        marginBottom: 20,
        opacity: entry.interim ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}>
        <div style={{
          maxWidth: "62%",
          padding: "10px 16px",
          borderRadius: "16px 16px 4px 16px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
          <p style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
            color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
            marginBottom: 5,
          }}>
            YOU
          </p>
          <p style={{
            fontSize: 14, color: "rgba(255,255,255,0.85)",
            lineHeight: 1.6, letterSpacing: "-0.005em",
            fontStyle: entry.interim ? "italic" : "normal",
          }}>
            {entry.text}
          </p>
        </div>
      </div>
    );
  }

  const agentId = entry.agentId ?? "aera";
  const agent = AGENTS[agentId];
  const rgb = hexToRgb(agent.color);

  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-start" }}>
      {/* Agent avatar mini */}
      <div style={{
        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
        background: `rgba(${rgb}, 0.12)`,
        border: `1px solid rgba(${rgb}, 0.22)`,
        display: "flex", alignItems: "center", justifyContent: "center",
        marginTop: 2,
      }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: agent.color }}>
          {agent.initials}
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
          color: agent.color, textTransform: "uppercase", marginBottom: 6,
        }}>
          {agent.name}
          {agentId === "aera" && (
            <span style={{
              marginLeft: 6, fontSize: 8, fontWeight: 500,
              color: "rgba(45,212,255,0.5)", letterSpacing: "0.04em",
              textTransform: "none",
            }}>
              · Chair
            </span>
          )}
        </p>
        <p style={{
          fontSize: 14, color: "rgba(255,255,255,0.80)",
          lineHeight: 1.7, letterSpacing: "-0.005em",
        }}>
          {entry.text}
        </p>
      </div>
    </div>
  );
}

/* ─── Conference Room Page ────────────────────────────────────────── */
export default function ConferencePage() {
  const [transcript,      setTranscript]      = useState<TranscriptEntry[]>([]);
  const [isProcessing,    setIsProcessing]    = useState(false);
  const [isMuted,         setIsMuted]         = useState(false);
  const [speakingAgentId, setSpeakingAgentId] = useState<AgentId | null>(null);
  const [currentInterim,  setCurrentInterim]  = useState("");
  const [audioEnabled,    setAudioEnabled]    = useState(true);

  const audioCtxRef     = useRef<AudioContext | null>(null);
  const sourceRef       = useRef<AudioBufferSourceNode | null>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const transcriptRef   = useRef<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Keep transcript ref in sync
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Unlock AudioContext on first interaction
  const unlockAudio = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ?? (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume().catch(() => {/* ignore */});
    }
  }, []);

  // Stop all audio
  const stopAudio = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    try { sourceRef.current?.stop(); } catch { /* ignore */ }
    sourceRef.current = null;
    setSpeakingAgentId(null);
  }, []);

  // Play segments sequentially
  const playSegments = useCallback(async (segments: AgentSegment[], signal: AbortSignal) => {
    if (!audioEnabled) return;

    // Ensure AudioContext exists and is running
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext ?? (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    for (const segment of segments) {
      if (signal.aborted) break;

      const agent = AGENTS[segment.agentId];
      setSpeakingAgentId(segment.agentId);

      // Pre-fetch next segment in parallel while current is playing
      const audioBuffer = await fetchAudioBuffer(ctx, segment.text, agent.voice_id, signal);
      if (!audioBuffer || signal.aborted) continue;

      await new Promise<void>((resolve) => {
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        sourceRef.current = source;
        source.onended = () => resolve();
        source.start(0);
      });

      if (signal.aborted) break;
      // Brief gap between agents
      await new Promise<void>((resolve) => setTimeout(resolve, 180));
    }
    if (!signal.aborted) setSpeakingAgentId(null);
  }, [audioEnabled]);

  // Build conversation history for API
  const buildApiMessages = useCallback(() => {
    return transcriptRef.current
      .filter((e) => !e.interim)
      .map((e) => ({
        role: e.role === "user" ? "user" : "aera",
        content: e.role === "user"
          ? e.text
          : e.text, // agent text goes as "aera" (assistant) role
      }));
  }, []);

  // Handle sending a message
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;
    setCurrentInterim("");

    const userEntry: TranscriptEntry = {
      id: `user-${Date.now()}`,
      role: "user",
      text: text.trim(),
      timestamp: new Date(),
    };

    setTranscript((prev) => [...prev, userEntry]);
    setIsProcessing(true);
    stopAudio();

    try {
      const apiMessages = [...buildApiMessages(), { role: "user", content: text.trim() }];

      const res = await fetch("/api/aera/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          systemOverride: MEETING_CONTEXT,
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { content?: string };
      const responseText = data.content ?? "I'm here. Go ahead.";

      // Parse into per-agent segments
      const segments = parseAgentSegments(responseText);

      // Add each segment to transcript
      const newEntries: TranscriptEntry[] = segments.map((seg, i) => ({
        id: `agent-${Date.now()}-${i}`,
        role: seg.agentId as TranscriptRole,
        agentId: seg.agentId,
        text: seg.text,
        timestamp: new Date(),
      }));

      setTranscript((prev) => [...prev, ...newEntries]);

      // Play sequentially with per-agent voices
      const controller = new AbortController();
      abortRef.current = controller;
      await playSegments(segments, controller.signal);

    } catch (err) {
      console.error("[Conference] error:", err);
      const fallback: TranscriptEntry = {
        id: `err-${Date.now()}`,
        role: "aera",
        agentId: "aera",
        text: "Connection briefly interrupted. I'm still here — go ahead.",
        timestamp: new Date(),
      };
      setTranscript((prev) => [...prev, fallback]);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, stopAudio, buildApiMessages, playSegments]);

  // Deepgram STT
  const { isListening, isConnecting, start: startSTT, stop: stopSTT, toggleMute } = useDeepgramSTT({
    onInterim: (text) => setCurrentInterim(text),
    onAutoSend: (text) => {
      setCurrentInterim("");
      handleSend(text);
    },
  });

  const handleMicToggle = useCallback(() => {
    unlockAudio();
    if (isListening) {
      stopSTT();
    } else {
      startSTT();
    }
  }, [isListening, startSTT, stopSTT, unlockAudio]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((m) => !m);
    toggleMute();
  }, [toggleMute]);

  // Opening message on mount
  useEffect(() => {
    const opening: TranscriptEntry = {
      id: "opening",
      role: "aera",
      agentId: "aera",
      text: "Conference room is live. The full team is present — Marcus, Sophia, Julian, Charlotte, and Victor Voss are ready. Press the microphone to speak, and I'll bring in whoever's most relevant to what you need.",
      timestamp: new Date(),
    };
    setTranscript([opening]);
  }, []);

  const micActive = isListening && !isMuted;

  return (
    <div
      className="force-dark flex flex-col h-full"
      style={{
        background: "linear-gradient(160deg, #080810 0%, #050508 60%, #080b14 100%)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient background */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(45,212,255,0.03) 0%, transparent 60%)",
      }} />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "18px 28px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,8,14,0.8)",
        backdropFilter: "blur(12px)",
        flexShrink: 0,
        zIndex: 10, position: "relative",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Room indicator */}
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 8px rgba(34,197,94,0.6)",
            animation: "breathe 2s ease-in-out infinite",
          }} />
          <div>
            <p style={{
              fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em",
              color: "rgba(255,255,255,0.92)", lineHeight: 1,
            }}>
              APEX Conference Room
            </p>
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.30)", marginTop: 3, letterSpacing: "0.04em" }}>
              {isProcessing ? "Team is responding…" : speakingAgentId ? `${AGENTS[speakingAgentId].name} is speaking` : micActive ? "Listening…" : "Room active · 6 agents present"}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* Audio toggle */}
          <button
            onClick={() => setAudioEnabled((a) => !a)}
            title={audioEnabled ? "Mute room audio" : "Unmute room audio"}
            style={{
              width: 36, height: 36, borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: audioEnabled ? "rgba(255,255,255,0.6)" : "rgba(255,100,100,0.7)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
          >
            {audioEnabled
              ? <Volume2 style={{ width: 15, height: 15 }} strokeWidth={1.6} />
              : <VolumeX style={{ width: 15, height: 15 }} strokeWidth={1.6} />
            }
          </button>

          {/* Exit */}
          <Link href="/dashboard">
            <button
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 36, padding: "0 14px", borderRadius: 9,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.45)",
                fontSize: 12, fontWeight: 500,
                cursor: "pointer", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
            >
              <X style={{ width: 12, height: 12 }} strokeWidth={2} />
              Leave
            </button>
          </Link>
        </div>
      </div>

      {/* ── Agent presence ring ──────────────────────────────────── */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: "clamp(16px, 3vw, 36px)",
        padding: "20px 28px 16px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        flexShrink: 0,
        zIndex: 5, position: "relative",
      }}>
        {AGENT_DISPLAY_ORDER.map((id) => (
          <AgentAvatar
            key={id}
            agentId={id}
            isSpeaking={speakingAgentId === id}
            size={40}
          />
        ))}
      </div>

      {/* ── Transcript ────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1, overflowY: "auto",
          padding: "28px clamp(16px, 4vw, 48px)",
          position: "relative",
        }}
      >
        {transcript.map((entry) => (
          <TranscriptRow key={entry.id} entry={entry} />
        ))}

        {/* Interim text */}
        {currentInterim && (
          <TranscriptRow entry={{
            id: "interim",
            role: "user",
            text: currentInterim,
            interim: true,
            timestamp: new Date(),
          }} />
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "rgba(45,212,255,0.12)",
              border: "1px solid rgba(45,212,255,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: "#2DD4FF" }}>SA</span>
            </div>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    width: 5, height: 5, borderRadius: "50%",
                    background: "rgba(45,212,255,0.6)",
                    animation: `breathe 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* ── Bottom controls ──────────────────────────────────────── */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 14, padding: "20px 28px 28px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(8,8,14,0.6)",
        backdropFilter: "blur(12px)",
        flexShrink: 0,
        position: "relative", zIndex: 10,
      }}>
        {/* Status label */}
        <p style={{
          fontSize: 11, letterSpacing: "0.08em",
          color: micActive
            ? "#2DD4FF"
            : isConnecting
            ? "rgba(255,255,255,0.35)"
            : "rgba(255,255,255,0.25)",
          textTransform: "uppercase",
          fontWeight: 600,
          transition: "color 0.3s",
        }}>
          {micActive
            ? "Listening — speak naturally"
            : isConnecting
            ? "Connecting microphone…"
            : isProcessing
            ? "Processing…"
            : "Tap to speak"}
        </p>

        {/* Control row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Mute toggle */}
          {isListening && (
            <button
              onClick={handleMuteToggle}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.10)",
                background: isMuted ? "rgba(255,100,100,0.10)" : "rgba(255,255,255,0.05)",
                color: isMuted ? "rgba(255,100,100,0.8)" : "rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {isMuted
                ? <MicOff style={{ width: 16, height: 16 }} strokeWidth={1.6} />
                : <Mic style={{ width: 16, height: 16 }} strokeWidth={1.6} />
              }
            </button>
          )}

          {/* Main mic button */}
          <button
            onClick={handleMicToggle}
            disabled={isProcessing}
            style={{
              width: 66, height: 66, borderRadius: "50%",
              border: `2px solid ${micActive ? "#2DD4FF" : "rgba(255,255,255,0.12)"}`,
              background: micActive
                ? "rgba(45,212,255,0.12)"
                : isProcessing
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.06)",
              color: micActive
                ? "#2DD4FF"
                : isProcessing
                ? "rgba(255,255,255,0.20)"
                : "rgba(255,255,255,0.55)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: isProcessing ? "default" : "pointer",
              boxShadow: micActive ? "0 0 28px rgba(45,212,255,0.20), 0 0 60px rgba(45,212,255,0.08)" : "none",
              transition: "all 0.25s",
            }}
            onMouseEnter={(e) => {
              if (!isProcessing && !micActive) {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                e.currentTarget.style.background = "rgba(255,255,255,0.09)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isProcessing && !micActive) {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }
            }}
          >
            {micActive
              ? <Mic style={{ width: 24, height: 24 }} strokeWidth={1.8} />
              : <MicOff style={{ width: 24, height: 24 }} strokeWidth={1.5} />
            }
          </button>

          {/* Stop audio */}
          {speakingAgentId && (
            <button
              onClick={stopAudio}
              style={{
                width: 44, height: 44, borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.05)",
                color: "rgba(255,255,255,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.2s",
              }}
              title="Stop speaking"
            >
              <Users style={{ width: 16, height: 16 }} strokeWidth={1.6} />
            </button>
          )}
        </div>

        <p style={{
          fontSize: 9, color: "rgba(255,255,255,0.15)",
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          APEX AERA · Conference Intelligence
        </p>
      </div>
    </div>
  );
}
