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

import { useState, useRef, useCallback, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mic, MicOff, X, Volume2, VolumeX } from "lucide-react";
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
const MEETING_CONTEXT = `[CONFERENCE ROOM] You are Sarah, running a quick team call with your client.

Vibe: think smart friends who work in marketing — casual, sharp, excited about the results. Not a boardroom. A real conversation where people actually talk to each other.

IDENTITY INTELLIGENCE: Read the client from how they speak. If they're casual and direct → drop the boardroom energy. If they use slang → stay real and grounded. If they're sharp and technical → skip the hand-holding. Adapt instantly, every agent mirrors the energy without announcing it. Charlotte is tuned to this — she quietly steers the team's tone.

EARLY CONVERSATION FLOW (first 1–2 exchanges after greeting):
If you just got the client's name for the first time — use it. Acknowledge it warmly (1 sentence), then ask what brings them in today or how they found APEX — keep it casual, one question. After they answer that, THEN you can naturally say "let me bring a couple people in" and introduce 1–2 agents who are most relevant to what they're working on. This makes the intro feel earned, not scripted.

CONVERSATION RULES:
- NO bullets, NO markdown, NO "as per our analysis" — just talk like a real person
- Sarah kicks things off, naturally brings in 1-2 agents who matter most for the topic
- Agents talk TO each other: "Marcus, back me up on that?" / "Charlotte, you've been talking to them — what's the feel?"
- Pull the client in: "What do you think?" / "Is that matching what you're seeing?" / "Which direction feels right?"
- 2 sentences MAX per person. Keep momentum — don't let it drag.
- Agents can hand off to each other without always coming back to Sarah
- Everyone genuinely cares about this client's success. Show enthusiasm, not formality.
- Always use the client's name once you know it — people love hearing their own name.
- Label every speaker: **Sarah:** **Marcus:** **Charlotte:** etc.

CRITICAL HANDOFF RULE — no exceptions:
If ANY agent addresses another agent by name and asks for their input ("Charlotte, what do you think?", "Marcus, back me up", "Sophia, your call"), that named agent MUST respond in the SAME message with their **Name:** label immediately after. NEVER end a response with an open handoff that goes unanswered. If Sarah asks Charlotte something, Charlotte replies in this same response. If Charlotte asks Marcus something, Marcus replies. Every handoff must be completed within this single response.`;

/* ─── Sequential TTS player ─────────────────────────────────────── */
// speed: 1.15 — slightly above natural (1.0) to give a confident, energetic
// delivery rather than the overly measured pace of the default setting.
async function fetchAudioBuffer(
  audioCtx: AudioContext,
  text: string,
  voiceId: string,
  signal: AbortSignal,
  speed = 1.15,
): Promise<AudioBuffer | null> {
  try {
    const res = await fetch("/api/voice/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, voice_id: voiceId, speed }),
      signal,
    });
    if (!res.ok || signal.aborted) {
      if (!signal.aborted) {
        const errText = await res.text().catch(() => "(no body)");
        console.error(`[TTS] ❌ ${res.status} for voice ${voiceId}:`, errText);
      }
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    if (signal.aborted) return null;
    return audioCtx.decodeAudioData(arrayBuffer.slice(0));
  } catch (err) {
    console.error("[TTS] ❌ fetch/decode error:", err);
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

/* ─── Thinking indicator ─────────────────────────────────────────── */
// Cycles through personality phrases while the team is processing a response.
// Makes the wait feel alive — Sarah is genuinely thinking, not just loading.
const THINKING_PHRASES = [
  "Hmm…",
  "Give me a second…",
  "Let me think on that…",
  "Pulling in the team…",
  "Working on it…",
  "Good question…",
  "One sec…",
  "Processing…",
];

function ThinkingIndicator({ phraseIndex }: { phraseIndex: number }) {
  const phrase = THINKING_PHRASES[phraseIndex % THINKING_PHRASES.length];
  return (
    <div style={{
      display: "flex", gap: 12, marginBottom: 20, alignItems: "center",
      animation: "fadeSlideIn 0.3s ease-out forwards",
    }}>
      {/* SA avatar */}
      <div style={{
        position: "relative", flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", inset: -3, borderRadius: "50%",
          border: "1.5px solid #2DD4FF",
          boxShadow: "0 0 8px rgba(45,212,255,0.35)",
          animation: "speakingRing 1.4s ease-in-out infinite",
        }} />
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "rgba(45,212,255,0.14)",
          border: "1.5px solid #2DD4FF",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 9, fontWeight: 800, color: "#2DD4FF" }}>SA</span>
        </div>
      </div>

      {/* Phrase + dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{
          fontSize: 13, color: "rgba(45,212,255,0.65)",
          fontStyle: "italic", letterSpacing: "-0.01em",
          animation: "fadeSlideIn 0.3s ease-out forwards",
          // key on phrase so it re-animates each cycle
        }} key={phrase}>
          {phrase}
        </span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "rgba(45,212,255,0.5)",
              animation: `breathe 1.1s ease-in-out ${i * 0.18}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Typewriter fade text ───────────────────────────────────────── */
// Reveals words progressively as the agent speaks.
// Runs slightly ahead of the audio (12% faster) so text is always leading speech
// — giving the user a beat to read while listening.
// When active=false (agent finished or entry is historical), all words are visible.
function TypingText({
  text,
  duration,
  active,
}: {
  text: string;
  duration: number;
  active: boolean;
}) {
  const words = useMemo(() => text.split(" "), [text]);
  const [visible, setVisible] = useState(active ? 0 : words.length);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      // Not speaking — show all words immediately (historical entry or interrupted)
      setVisible(words.length);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      return;
    }
    // Start progressive fade reveal at 12% faster than audio duration
    setVisible(0);
    const totalMs = Math.max(duration * 880, words.length * 55); // floor: 55ms/word min
    const msPerWord = totalMs / words.length;
    let count = 0;
    timerRef.current = setInterval(() => {
      count++;
      setVisible(Math.min(count, words.length));
      if (count >= words.length) {
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    }, msPerWord);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [active, text, duration, words.length]);

  return (
    <>
      {words.map((word, i) => (
        <span
          key={i}
          style={{
            opacity: i < visible ? 1 : 0,
            transition: "opacity 0.22s ease",
            display: "inline",
          }}
        >
          {word}{i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

/* ─── Transcript message row ─────────────────────────────────────── */
function TranscriptRow({ entry, isSpeaking = false, speakingDuration = 0 }: { entry: TranscriptEntry; isSpeaking?: boolean; speakingDuration?: number }) {
  const isUser = entry.role === "user";

  if (isUser) {
    return (
      <div style={{
        display: "flex", justifyContent: "flex-end",
        marginBottom: 20,
        opacity: entry.interim ? 0.5 : 1,
        animation: entry.interim ? undefined : "fadeSlideIn 0.35s ease-out forwards",
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
    <div style={{
      display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-start",
      // Smooth fade-slide in when the entry first appears
      animation: "fadeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      // Speaking: left accent bar + subtle bg tint
      borderLeft: isSpeaking
        ? `2px solid ${agent.color}`
        : "2px solid transparent",
      paddingLeft: isSpeaking ? 14 : 0,
      marginLeft: isSpeaking ? -16 : 0,
      borderRadius: isSpeaking ? "0 10px 10px 0" : 0,
      background: isSpeaking ? `rgba(${rgb}, 0.05)` : "transparent",
      padding: isSpeaking ? "10px 10px 10px 14px" : "0",
      transition: "border-color 0.3s, background 0.4s, padding 0.3s, margin 0.3s",
    }}>
      {/* Agent avatar mini — glows when speaking */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        {isSpeaking && (
          /* Pulsing ring around avatar while speaking */
          <div style={{
            position: "absolute", inset: -4,
            borderRadius: "50%",
            border: `1.5px solid ${agent.color}`,
            boxShadow: `0 0 10px rgba(${rgb}, 0.45)`,
            animation: "speakingRing 1.1s ease-in-out infinite",
            pointerEvents: "none",
          }} />
        )}
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: isSpeaking ? `rgba(${rgb}, 0.18)` : `rgba(${rgb}, 0.10)`,
          border: `1.5px solid ${isSpeaking ? agent.color : `rgba(${rgb}, 0.22)`}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginTop: 2,
          transition: "all 0.3s",
          boxShadow: isSpeaking ? `0 0 12px rgba(${rgb}, 0.30)` : "none",
        }}>
          <span style={{
            fontSize: 9, fontWeight: 800,
            color: isSpeaking ? agent.color : `rgba(${rgb}, 0.7)`,
            transition: "color 0.3s",
          }}>
            {agent.initials}
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <p style={{
            fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            color: isSpeaking ? agent.color : `rgba(${rgb}, 0.7)`,
            textTransform: "uppercase",
            transition: "color 0.3s",
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
          {/* Live speaking dot */}
          {isSpeaking && (
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: agent.color,
              boxShadow: `0 0 6px ${agent.color}`,
              animation: "breathe 0.9s ease-in-out infinite",
              flexShrink: 0,
            }} />
          )}
        </div>
        <p style={{
          fontSize: 14,
          color: isSpeaking ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.78)",
          lineHeight: 1.7, letterSpacing: "-0.005em",
          transition: "color 0.3s",
        }}>
          {isSpeaking && speakingDuration > 0
            ? <TypingText text={entry.text} duration={speakingDuration} active={true} />
            : entry.text
          }
        </p>
      </div>
    </div>
  );
}

const CONFERENCE_STORAGE_KEY = "apex_conference_transcript_v1";
const ONBOARD_KEY            = "apex_onboarded_v1";

/* ─── First-meeting onboarding context ──────────────────────────── */
const ONBOARDING_CONTEXT = `[FIRST GREETING — SARAH ONLY]

This is literally the first moment this person opens the room. Sarah speaks alone — no other agents yet.

Sarah's entire job right now:
1. Say hi warmly — like a real person, not a product demo. 1 sentence.
2. Introduce herself in one sentence: her name (Sarah) and what she does ("I run the intelligence side of APEX AERA")
3. Ask for their name in a natural, conversational way — NOT "Please state your name for the record." More like "First thing's first — who am I talking to?" or "I don't think we've met — what's your name?"

That's it. 3 short sentences max. This is the opening line of a real conversation, not a presentation.

DO NOT: introduce any other agents, talk about campaigns, ask about their business yet.
DO NOT: use **Charlotte:** or **Marcus:** or any other agent label.
ONLY use: **Sarah:**

After the client tells Sarah their name, the NEXT response will naturally continue the conversation — asking what brings them in, then introducing the team. But that's not this message.`;

/* ─── Internal trigger ───────────────────────────────────────────── */
// Sentinel value used to trigger the onboarding AI call without showing
// a "user" message in the transcript. Detected in handleSend to branch logic.
const ONBOARD_TRIGGER = "__APEX_ONBOARD__";

function loadTranscript(): TranscriptEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONFERENCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Array<TranscriptEntry & { timestamp: string }>;
    return parsed.map((e) => ({ ...e, timestamp: new Date(e.timestamp) }));
  } catch { return []; }
}

function saveTranscript(entries: TranscriptEntry[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CONFERENCE_STORAGE_KEY, JSON.stringify(entries.slice(-80))); }
  catch { /* quota */ }
}

/* ─── Conference Room Page ────────────────────────────────────────── */
// Exported wrapper adds Suspense boundary required by useSearchParams in Next.js 15
export default function ConferencePageWrapper() {
  return (
    <Suspense>
      <ConferencePage />
    </Suspense>
  );
}

function ConferencePage() {
  const searchParams  = useSearchParams();
  const handleSendRef = useRef<(text: string) => Promise<void>>(() => Promise.resolve());

  const [transcript,      setTranscript]      = useState<TranscriptEntry[]>([]);
  const [isProcessing,     setIsProcessing]     = useState(false);
  const [isMuted,          setIsMuted]          = useState(false);
  const [speakingAgentId,  setSpeakingAgentId]  = useState<AgentId | null>(null);
  const [speakingDuration,  setSpeakingDuration]  = useState<number>(0);
  const [thinkingPhrase,   setThinkingPhrase]    = useState(0);
  const [currentInterim,  setCurrentInterim]  = useState("");
  const [audioEnabled,    setAudioEnabled]    = useState(true);

  const audioCtxRef     = useRef<AudioContext | null>(null);
  const sourceRef       = useRef<AudioBufferSourceNode | null>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const transcriptRef   = useRef<TranscriptEntry[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Keep transcript ref in sync + persist to sessionStorage
  useEffect(() => {
    transcriptRef.current = transcript;
    if (transcript.length > 0) saveTranscript(transcript);
  }, [transcript]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Cycle thinking phrase every 2.2 s while processing
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setThinkingPhrase((p) => (p + 1) % THINKING_PHRASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Safety valve: if isProcessing stays true for >30 s something hung — reset it.
  // This prevents the UI from being permanently locked waiting for a response
  // that will never come (network drop, API timeout, etc.).
  useEffect(() => {
    if (!isProcessing) return;
    const safety = setTimeout(() => {
      setIsProcessing(false);
      setSpeakingAgentId(null);
      setSpeakingDuration(0);
      const recovery: TranscriptEntry = {
        id: `recovery-${Date.now()}`,
        role: "aera", agentId: "aera",
        text: "Hey — I think we had a connection hiccup. I'm back now. What were you saying?",
        timestamp: new Date(),
      };
      setTranscript((prev) => [...prev, recovery]);
    }, 30_000);
    return () => clearTimeout(safety);
  }, [isProcessing]);

  // Stop all audio on unmount (e.g. user navigates away via Leave button)
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
      try { sourceRef.current?.stop(); } catch { /* ignore */ }
      sourceRef.current = null;
    };
  }, []);

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

  // Play segments sequentially — all TTS fetches start in parallel so
  // each agent's audio is ready by the time the previous one finishes.
  //
  // SEQUENTIAL REVEAL: entries are added to the transcript one-by-one,
  // each revealed just as that agent's audio begins playing. This creates
  // the "one speaker at a time" effect instead of everything popping in at once.
  const playSegments = useCallback(async (
    segments: AgentSegment[],
    entries: TranscriptEntry[],
    signal: AbortSignal,
  ) => {
    // Transcript entries are ALWAYS revealed — even if audio is disabled or TTS fails.
    // Audio is purely additive on top of the transcript reveal.

    // Set up AudioContext only if audio is enabled
    let ctx: AudioContext | null = null;
    if (audioEnabled) {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ?? (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();
    }

    // Fire ALL TTS requests in parallel (only if audio is enabled)
    const bufferPromises: Promise<AudioBuffer | null>[] = audioEnabled && ctx
      ? segments.map((seg) =>
          fetchAudioBuffer(
            ctx!,
            seg.text,
            AGENTS[seg.agentId].voice_id,
            signal,
            AGENTS[seg.agentId].ttsSpeed ?? 1.25,
          )
        )
      : segments.map(() => Promise.resolve(null));

    for (let i = 0; i < segments.length; i++) {
      if (signal.aborted) break;

      // Await buffer (already resolving in parallel — fast)
      const audioBuffer = await bufferPromises[i];
      if (signal.aborted) break;

      const segDuration = audioBuffer?.duration ?? 0;

      // Small stagger before first entry so the processing indicator fades
      if (i === 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      }
      if (signal.aborted) break;

      // ── ALWAYS reveal transcript entry — regardless of audio success ──
      setTranscript((prev) => [...prev, entries[i]]);

      // Brief pause — text appears, user reads name, then voice starts
      await new Promise<void>((resolve) => setTimeout(resolve, 90));
      if (signal.aborted) break;

      // Set speaking state WITH duration so TypingText can sync word reveal
      setSpeakingDuration(segDuration);
      setSpeakingAgentId(segments[i].agentId);

      if (audioBuffer && ctx) {
        // Play audio
        await new Promise<void>((resolve) => {
          const source = ctx!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx!.destination);
          sourceRef.current = source;
          source.onended = () => resolve();
          source.start(0);
        });
      } else {
        // No audio — wait based on word count so text is readable before next segment
        const wordCount = segments[i].text.split(" ").length;
        await new Promise<void>((resolve) =>
          setTimeout(resolve, Math.max(1500, wordCount * 180))
        );
      }

      if (signal.aborted) break;
      // Per-agent inter-segment gap (default 100ms).
      // Victor gets a longer pause so his weight lands before the next speaker.
      if (i < segments.length - 1) {
        const gap = AGENTS[segments[i].agentId].pauseAfter ?? 100;
        await new Promise<void>((resolve) => setTimeout(resolve, gap));
      }
    }
    if (!signal.aborted) {
      setSpeakingAgentId(null);
      setSpeakingDuration(0);
    }
  }, [audioEnabled]);

  // Build conversation history for API.
  //
  // Two rules the Anthropic API enforces:
  //   1. Messages must strictly alternate user / assistant.
  //   2. The FIRST message must be "user".
  //
  // Multi-agent turns (Sarah + Charlotte + Marcus) each become a separate
  // TranscriptEntry with role "aera", causing consecutive assistant messages.
  // The opening / onboarding message is also "aera", making the first message
  // an assistant turn. Both are 400 errors that cause the "thinking → blank" bug.
  //
  // Fix: merge consecutive same-role messages, then strip any leading "aera"
  // entries so the history always starts with a user message.
  const buildApiMessages = useCallback(() => {
    const raw = transcriptRef.current
      .filter((e) => !e.interim)
      .map((e) => ({
        role: e.role === "user" ? "user" : "aera",
        content: e.text,
      }));

    // Step 1 — merge consecutive same-role messages
    const merged: Array<{ role: string; content: string }> = [];
    for (const msg of raw) {
      const last = merged[merged.length - 1];
      if (last && last.role === msg.role) {
        last.content += " " + msg.content;
      } else {
        merged.push({ role: msg.role, content: msg.content });
      }
    }

    // Step 2 — drop leading "aera" messages so history starts with "user"
    while (merged.length > 0 && merged[0].role !== "user") {
      merged.shift();
    }

    return merged;
  }, []);

  // Handle sending a message.
  // If text === ONBOARD_TRIGGER: no user entry is shown — this fires a hidden
  // onboarding call so the team intro appears without a "user" bubble.
  const handleSend = useCallback(async (text: string) => {
    const isOnboarding = text === ONBOARD_TRIGGER;
    // Allow interrupt during audio playback (isProcessing=false then),
    // but block if an API call is still in-flight.
    if ((!text.trim() && !isOnboarding) || isProcessing) return;
    setCurrentInterim("");

    if (!isOnboarding) {
      const userEntry: TranscriptEntry = {
        id: `user-${Date.now()}`,
        role: "user",
        text: text.trim(),
        timestamp: new Date(),
      };
      setTranscript((prev) => [...prev, userEntry]);
    }

    setIsProcessing(true);
    stopAudio();

    try {
      // Onboarding: empty prior history + special context. Normal: build from transcript.
      const apiMessages = isOnboarding
        ? [{ role: "user", content: "Begin." }]
        : [...buildApiMessages(), { role: "user", content: text.trim() }];

      const effectiveContext = isOnboarding ? ONBOARDING_CONTEXT : MEETING_CONTEXT;

      const res = await fetch("/api/aera/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          systemOverride: effectiveContext,
        }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json() as { content?: string };
      const responseText = data.content ?? "I'm here. Go ahead.";

      // Parse into per-agent segments
      const segments = parseAgentSegments(responseText);

      // Build per-segment transcript entries — revealed one-by-one in playSegments
      const ts = Date.now();
      const newEntries: TranscriptEntry[] = segments.map((seg, i) => ({
        id: `agent-${ts}-${i}`,
        role: seg.agentId as TranscriptRole,
        agentId: seg.agentId,
        text: seg.text,
        timestamp: new Date(),
      }));

      // ── Interrupt fix: mark API call done BEFORE audio starts ──
      // This lets onAutoSend fire a new handleSend (which calls stopAudio)
      // while agents are still speaking — enabling true voice interrupts.
      setIsProcessing(false);

      // Play sequentially — each entry is added to transcript as its audio begins
      const controller = new AbortController();
      abortRef.current = controller;
      await playSegments(segments, newEntries, controller.signal);

    } catch (err) {
      console.error("[Conference] handleSend error:", err);
      // Show the actual error message in dev so issues are surfaced clearly
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[Conference] detail:", errMsg);
      const fallback: TranscriptEntry = {
        id: `err-${Date.now()}`,
        role: "aera",
        agentId: "aera",
        text: "Hey — hit a small snag on my end. Go ahead and repeat that.",
        timestamp: new Date(),
      };
      setTranscript((prev) => [...prev, fallback]);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, stopAudio, buildApiMessages, playSegments]);

  // Keep a stable ref to handleSend so the mount effect can call it
  // after the initial render without capturing a stale closure.
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

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

  // Opening message on mount — restore previous session, onboard first-timers, or start fresh
  useEffect(() => {
    const saved = loadTranscript();
    if (saved.length > 0) {
      // Restore previous session as-is
      setTranscript(saved);
      return;
    }

    // Check if this client has been onboarded before
    const hasOnboarded = typeof window !== "undefined" && !!localStorage.getItem(ONBOARD_KEY);

    if (!hasOnboarded) {
      // First time in the room — run the team intro / onboarding flow
      localStorage.setItem(ONBOARD_KEY, "true");
      // Leave transcript empty so only the processing indicator shows while loading
      setTimeout(() => {
        handleSendRef.current(ONBOARD_TRIGGER);
      }, 400);
    } else if (searchParams?.get("report") === "full") {
      // Full Report shortcut — skip opening message, go straight to briefing
      setTimeout(() => {
        handleSendRef.current("Give me a full status report — campaigns, performance metrics, what's working, what needs attention, and our top priority right now.");
      }, 300);
    } else {
      // Normal session — show brief room opening
      const opening: TranscriptEntry = {
        id: "opening",
        role: "aera",
        agentId: "aera",
        text: "Hey — full team is here. Marcus, Sophia, Julian, Charlotte, and Victor are all in. Hit the mic and let's get into it.",
        timestamp: new Date(),
      };
      setTranscript([opening]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

          {/* Clear transcript */}
          <button
            onClick={() => {
              stopAudio();
              localStorage.removeItem(CONFERENCE_STORAGE_KEY);
              const fresh: TranscriptEntry = {
                id: `opening-${Date.now()}`,
                role: "aera", agentId: "aera",
                text: "Room cleared — fresh start. What do you want to work on?",
                timestamp: new Date(),
              };
              setTranscript([fresh]);
            }}
            style={{
              height: 36, padding: "0 12px", borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.07)",
              background: "transparent",
              color: "rgba(255,255,255,0.28)",
              fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.28)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
          >
            Clear
          </button>

          {/* Stop — halts conversation + mic without leaving the room */}
          <button
            onClick={() => { stopAudio(); stopSTT(); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 36, padding: "0 14px", borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.04)",
              color: "rgba(255,255,255,0.45)",
              fontSize: 12, fontWeight: 500,
              cursor: "pointer", transition: "all 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,80,80,0.08)"; e.currentTarget.style.borderColor = "rgba(255,80,80,0.18)"; e.currentTarget.style.color = "rgba(255,120,120,0.8)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
          >
            <X style={{ width: 12, height: 12 }} strokeWidth={2} />
            Stop
          </button>
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
        {(() => {
          // Find the ID of the most recently added entry for the speaking agent.
          // Since entries are revealed one-by-one as audio plays, this is always
          // the entry currently being spoken — only that row gets the glow.
          // Most-recent entry for the speaking agent = the one being spoken now
          const speakingEntryId = speakingAgentId
            ? [...transcript].reverse().find((e) => e.agentId === speakingAgentId)?.id
            : undefined;
          return transcript.map((entry) => {
            const isActive = entry.id === speakingEntryId;
            return (
              <TranscriptRow
                key={entry.id}
                entry={entry}
                isSpeaking={isActive}
                speakingDuration={isActive ? speakingDuration : 0}
              />
            );
          });
        })()}

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

        {/* Processing indicator — cycling thinking phrases */}
        {isProcessing && <ThinkingIndicator phraseIndex={thinkingPhrase} />}

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
            ? "rgba(245,158,11,0.75)"   // amber — reconnecting
            : "rgba(255,255,255,0.25)",
          textTransform: "uppercase",
          fontWeight: 600,
          transition: "color 0.3s",
        }}>
          {micActive
            ? "Listening — speak naturally"
            : isConnecting
            ? "Reconnecting microphone…"
            : isProcessing
            ? "Processing…"
            : !isListening
            ? "Tap mic to speak"
            : "Ready — tap to speak"}
        </p>

        {/* Reconnect nudge — shown when mic is not active and not connecting */}
        {!isListening && !isConnecting && !isProcessing && (
          <p style={{
            fontSize: 10, color: "rgba(255,255,255,0.22)",
            letterSpacing: "0.04em", marginTop: -6,
          }}>
            Mic is off — tap the button below to start listening
          </p>
        )}

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
              <VolumeX style={{ width: 16, height: 16 }} strokeWidth={1.6} />
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
