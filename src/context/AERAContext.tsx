"use client";

import {
  createContext, useContext, useState, useCallback,
  useRef, useEffect, ReactNode,
} from "react";
import { useClientMemory, extractMetricsFromText } from "./ClientMemory";
import { useElevenLabsTTS, TTSSpeed } from "@/hooks/useElevenLabsTTS";
import { AGENTS, parseAgentSegments } from "@/lib/agents";
import type { AgentId } from "@/lib/agents";

export type ChartData = {
  type: "bar" | "line" | "radar" | "pie";
  title: string;
  labels: string[];
  data: number[];
  unit?: string;
};

export type Message = {
  id: string;
  role: "aera" | "user";
  content: string;
  thinking?: string | null;
  chart?: ChartData | null;
  timestamp: Date;
};

// ── Thread & Folder types ────────────────────────────────────────
export type ChatFolder = {
  id: string;
  name: string;
  createdAt: string;
};

export type ChatThread = {
  id: string;
  name: string;
  folderId: string | null;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

const THREADS_KEY       = "aera_threads_v1";
const FOLDERS_KEY       = "aera_folders_v1";
const ACTIVE_THREAD_KEY = "aera_active_thread_v1";
const LEGACY_MSG_KEY    = "aera_messages_v2";
const MAX_STORED        = 100;

const GREETING: Message = {
  id: "aera-intro",
  role: "aera",
  content:
    "Good morning. Your Q2 brand launch is running at 4.2× velocity — 18% ahead of target. How can I help you today?",
  timestamp: new Date(),
};

const FALLBACK_RESPONSES = [
  "I'm having trouble reaching my intelligence layer right now. Please try again in a moment.",
  "Connection to AERA intelligence is temporarily interrupted. Your account team has been notified.",
];

function newId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;
}

function makeDefaultThread(messages: Message[]): ChatThread {
  return {
    id: "thread-default",
    name: "AERA Intelligence",
    folderId: null,
    messages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ── Thread storage ────────────────────────────────────────────────
function loadThreads(): { threads: ChatThread[]; folders: ChatFolder[]; activeId: string } {
  if (typeof window === "undefined") {
    const t = makeDefaultThread([GREETING]);
    return { threads: [t], folders: [], activeId: t.id };
  }
  try {
    const raw        = localStorage.getItem(THREADS_KEY);
    const rawFolders = localStorage.getItem(FOLDERS_KEY);
    const activeId   = localStorage.getItem(ACTIVE_THREAD_KEY) ?? "thread-default";

    let threads: ChatThread[] = raw ? JSON.parse(raw) : [];
    const folders: ChatFolder[] = rawFolders ? JSON.parse(rawFolders) : [];

    // Migration: convert legacy flat messages to a default thread
    if (!threads.length) {
      const legacyRaw = localStorage.getItem(LEGACY_MSG_KEY);
      let legacyMsgs: Message[] = [GREETING];
      if (legacyRaw) {
        try {
          const parsed = JSON.parse(legacyRaw) as Array<{ id: string; role: string; content: string; timestamp: string }>;
          if (Array.isArray(parsed) && parsed.length) {
            legacyMsgs = parsed.map((m) => ({
              ...m,
              role: m.role as Message["role"],
              timestamp: new Date(m.timestamp),
            }));
          }
        } catch { /* ignore */ }
      }
      threads = [makeDefaultThread(legacyMsgs)];
    }

    // Deserialize message timestamps
    threads = threads.map((t) => ({
      ...t,
      messages: t.messages.map((m: Message & { timestamp: string | Date }) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    }));

    const resolvedId = threads.find((t) => t.id === activeId) ? activeId : threads[0].id;
    return { threads, folders, activeId: resolvedId };
  } catch {
    const t = makeDefaultThread([GREETING]);
    return { threads: [t], folders: [], activeId: t.id };
  }
}

function saveThreads(threads: ChatThread[], folders: ChatFolder[], activeId: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(
      threads.map((t) => ({ ...t, messages: t.messages.slice(-MAX_STORED) }))
    ));
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    localStorage.setItem(ACTIVE_THREAD_KEY, activeId);
  } catch { /* quota */ }
}

// ── Context type ────────────────────────────────────────────────
type AERAContextType = {
  isOpen: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  messages: Message[];
  addUserMessage: (content: string) => void;
  isTyping: boolean;
  isSpeaking: boolean;
  speakingMessageId: string | null;
  speak: (text: string, id: string) => void;
  stopSpeaking: () => void;
  speakMultiAgent: (text: string, id: string) => void;
  unlockAudio: () => void;
  ttsSpeed: TTSSpeed;
  setTtsSpeed: (speed: TTSSpeed) => void;
  voiceMode: boolean;
  toggleVoiceMode: () => void;
  clearHistory: () => void;
  /** Currently selected agent ID — used to route voice through the right ElevenLabs voice */
  selectedAgentId: AgentId;
  // ── Thread management ─────────────────────────────────────────
  threads: ChatThread[];
  folders: ChatFolder[];
  activeThreadId: string;
  createThread: (name?: string, folderId?: string | null) => void;
  createFolder: (name: string) => void;
  switchThread: (id: string) => void;
  renameThread: (id: string, name: string) => void;
  deleteThread: (id: string) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  moveThread: (threadId: string, folderId: string | null) => void;
};

const AERAContext = createContext<AERAContextType | null>(null);

export function AERAProvider({ children }: { children: ReactNode }) {
  const [isOpen,    setIsOpen]    = useState(false);

  // ── CRITICAL: Start with SSR-safe state — hydrate from localStorage after mount.
  const [messages,       setMessages]       = useState<Message[]>([GREETING]);
  const [threads,        setThreads]        = useState<ChatThread[]>([makeDefaultThread([GREETING])]);
  const [folders,        setFolders]        = useState<ChatFolder[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("thread-default");
  const [isTyping,       setIsTyping]       = useState(false);
  const [voiceMode,      setVoiceMode]      = useState(false);

  const messagesRef     = useRef<Message[]>([GREETING]);
  const threadsRef      = useRef<ChatThread[]>([makeDefaultThread([GREETING])]);
  const foldersRef      = useRef<ChatFolder[]>([]);
  const activeThreadRef = useRef<string>("thread-default");
  const voiceModeRef    = useRef(false);

  // ── ElevenLabs TTS ────────────────────────────────────────────
  // Replaces window.speechSynthesis entirely. API key stays server-side.
  const {
    isSpeaking:        isSpeakingSingle,
    speakingMessageId,
    speak,
    stop: stopSpeakingSingle,
    unlockAudio,
    ttsSpeed,
    setTtsSpeed,
  } = useElevenLabsTTS();

  // ── Multi-voice sequential TTS ────────────────────────────────
  // Used when a response contains **AgentName:** labels (team meeting / conference mode).
  // All TTS requests fire in parallel; audio plays sequentially per agent.
  const [isMultiVoice,     setIsMultiVoice]     = useState(false);
  const multiCtxRef   = useRef<AudioContext | null>(null);
  const multiAbortRef = useRef<AbortController | null>(null);

  const stopMultiVoice = useCallback(() => {
    multiAbortRef.current?.abort();
    multiAbortRef.current = null;
    setIsMultiVoice(false);
  }, []);

  const speakMultiAgent = useCallback(async (text: string, msgId: string) => {
    void msgId; // reserved for future speakingMessageId tracking
    stopMultiVoice();
    stopSpeakingSingle();

    if (typeof window === "undefined") return;
    if (!multiCtxRef.current) {
      multiCtxRef.current = new (window.AudioContext ?? (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }
    const ctx = multiCtxRef.current;
    if (ctx.state === "suspended") await ctx.resume();

    const controller = new AbortController();
    multiAbortRef.current = controller;
    const { signal } = controller;

    const segments = parseAgentSegments(text);

    // Fire ALL TTS requests in parallel — each is ready when previous finishes playing
    const fetches = segments.map((seg) =>
      fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: seg.text, voice_id: AGENTS[seg.agentId].voice_id, speed: 1.2 }),
        signal,
      })
    );

    setIsMultiVoice(true);
    for (let i = 0; i < segments.length; i++) {
      if (signal.aborted) break;
      try {
        const res = await fetches[i];
        if (!res.ok || signal.aborted) continue;
        const buf = await res.arrayBuffer();
        if (signal.aborted) continue;
        const audioBuf = await ctx.decodeAudioData(buf);
        await new Promise<void>((resolve) => {
          const src = ctx.createBufferSource();
          src.buffer = audioBuf;
          src.connect(ctx.destination);
          src.onended = () => resolve();
          src.start(0);
        });
        if (!signal.aborted && i < segments.length - 1) {
          await new Promise<void>((r) => setTimeout(r, 100));
        }
      } catch { /* aborted or decode error */ }
    }
    if (!signal.aborted) setIsMultiVoice(false);
  }, [stopMultiVoice, stopSpeakingSingle]);

  // Combined isSpeaking covers both single-voice and multi-voice playback
  const isSpeaking  = isSpeakingSingle || isMultiVoice;
  const stopSpeaking = useCallback(() => {
    stopSpeakingSingle();
    stopMultiVoice();
  }, [stopSpeakingSingle, stopMultiVoice]);

  // Memory — save insights + extract metrics from every AERA response
  const { addInsight, updateStats, memory } = useClientMemory();
  const selectedAgentId = memory.selectedAgentId;

  // ── CRITICAL: Ref so addUserMessage (useCallback) always reads the
  // latest selectedAgentId without needing to be recreated on every change.
  // Without this, the callback closes over a stale value from render time.
  const selectedAgentIdRef = useRef<AgentId>(selectedAgentId);
  useEffect(() => { selectedAgentIdRef.current = selectedAgentId; }, [selectedAgentId]);

  // ── Hydration-safe localStorage load ──────────────────────────
  useEffect(() => {
    const { threads: loadedThreads, folders: loadedFolders, activeId } = loadThreads();
    const activeThread = loadedThreads.find((t) => t.id === activeId) ?? loadedThreads[0];
    setThreads(loadedThreads);
    setFolders(loadedFolders);
    setActiveThreadId(activeThread.id);
    setMessages(activeThread.messages);
    threadsRef.current      = loadedThreads;
    foldersRef.current      = loadedFolders;
    activeThreadRef.current = activeThread.id;
    messagesRef.current     = activeThread.messages;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist whenever threads, folders, or active thread changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, [messages]); // re-save when messages change (threads already updated via ref)

  const togglePanel   = useCallback(() => setIsOpen((p) => !p), []);
  const openPanel     = useCallback(() => setIsOpen(true), []);
  const closePanel    = useCallback(() => setIsOpen(false), []);

  const toggleVoiceMode = useCallback(() => {
    setVoiceMode((p) => {
      voiceModeRef.current = !p;
      return !p;
    });
  }, []);

  // ── API call ───────────────────────────────────────────────────
  const addUserMessage = useCallback(async (content: string) => {
    // If AERA is currently speaking (auto-TTS in voice mode), interrupt it
    // so the new response doesn't stack on top of the ongoing one.
    if (voiceModeRef.current) {
      stopSpeaking();
    }

    const userMsg: Message = {
      // crypto.randomUUID() is guaranteed unique — avoids collisions when
      // addUserMessage is called twice within the same millisecond (e.g. STT
      // auto-send fires while the user also presses Enter).
      id: `user-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };

    const apiMessages = [...messagesRef.current, userMsg]
      .filter((m) => m.id !== "aera-intro")
      .map((m) => ({ role: m.role, content: m.content }));

    const withUser = [...messagesRef.current, userMsg];
    messagesRef.current = withUser;
    setMessages(withUser);
    threadsRef.current = threadsRef.current.map((t) =>
      t.id === activeThreadRef.current ? { ...t, messages: withUser, updatedAt: new Date().toISOString() } : t
    );
    setThreads([...threadsRef.current]);
    setIsTyping(true);

    try {
      const res = await fetch("/api/aera/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data            = await res.json() as { content?: string; thinking?: string | null; chart?: ChartData | null };
      const responseContent = res.ok
        ? (data.content ?? FALLBACK_RESPONSES[0])
        : FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
      const thinkingContent = res.ok ? (data.thinking ?? null) : null;
      const chartContent    = res.ok ? (data.chart ?? null) : null;

      const aeraMsg: Message = {
        id: `aera-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()}`,
        role: "aera",
        content: responseContent,
        thinking: thinkingContent,
        chart: chartContent,
        timestamp: new Date(),
      };

      const withAera = [...messagesRef.current, aeraMsg];
      messagesRef.current = withAera;
      setMessages(withAera);
      // Update active thread's messages in the threads array
      threadsRef.current = threadsRef.current.map((t) =>
        t.id === activeThreadRef.current ? { ...t, messages: withAera, updatedAt: new Date().toISOString() } : t
      );
      setThreads([...threadsRef.current]);

      // ── Save to memory ──────────────────────────────────────
      if (res.ok && responseContent.length > 20) {
        const snippet = responseContent.slice(0, 180).replace(/\s+/g, " ").trim();
        addInsight(snippet, "aera");
      }
      const metricUpdates = extractMetricsFromText(responseContent);
      if (Object.keys(metricUpdates).length > 0) updateStats(metricUpdates);

      // Auto-TTS in voice mode.
      // If the response contains **AgentName:** labels, play each agent in their own
      // voice sequentially (multi-voice). Otherwise, use the selected agent's voice.
      if (voiceModeRef.current) {
        const hasAgentLabels = /\*\*[\w\s]+:\*\*/.test(responseContent);
        if (hasAgentLabels) {
          speakMultiAgent(responseContent, aeraMsg.id);
        } else {
          const agentVoiceId = AGENTS[selectedAgentIdRef.current]?.voice_id;
          speak(responseContent, aeraMsg.id, agentVoiceId);
        }
      }
    } catch {
      const fallback: Message = {
        id: `aera-err-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Date.now() + Math.random()}`,
        role: "aera",
        content: FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)],
        timestamp: new Date(),
      };
      const withFallback = [...messagesRef.current, fallback];
      messagesRef.current = withFallback;
      setMessages(withFallback);
      threadsRef.current = threadsRef.current.map((t) =>
        t.id === activeThreadRef.current ? { ...t, messages: withFallback, updatedAt: new Date().toISOString() } : t
      );
      setThreads([...threadsRef.current]);
      if (voiceModeRef.current) {
        const agentVoiceId = AGENTS[selectedAgentIdRef.current]?.voice_id;
        speak(fallback.content, fallback.id, agentVoiceId); // fallback is always single voice
      }
    } finally {
      setIsTyping(false);
    }
  }, [speak, stopSpeaking]);

  const clearHistory = useCallback(() => {
    stopSpeaking();
    const reset = [GREETING];
    messagesRef.current = reset;
    setMessages(reset);
    threadsRef.current = threadsRef.current.map((t) =>
      t.id === activeThreadRef.current ? { ...t, messages: reset, updatedAt: new Date().toISOString() } : t
    );
    setThreads([...threadsRef.current]);
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, [stopSpeaking]);

  // ── Thread management ─────────────────────────────────────────
  const createThread = useCallback((name?: string, folderId: string | null = null) => {
    const id = `thread-${newId()}`;
    const now = new Date().toISOString();
    const newThread: ChatThread = {
      id,
      name: name ?? `New Chat ${threadsRef.current.length + 1}`,
      folderId,
      messages: [GREETING],
      createdAt: now,
      updatedAt: now,
    };
    threadsRef.current = [newThread, ...threadsRef.current];
    setThreads([...threadsRef.current]);
    // Switch to new thread
    activeThreadRef.current = id;
    setActiveThreadId(id);
    messagesRef.current = [GREETING];
    setMessages([GREETING]);
    saveThreads(threadsRef.current, foldersRef.current, id);
  }, []);

  const switchThread = useCallback((id: string) => {
    const thread = threadsRef.current.find((t) => t.id === id);
    if (!thread) return;
    stopSpeaking();
    activeThreadRef.current = id;
    setActiveThreadId(id);
    messagesRef.current = thread.messages;
    setMessages(thread.messages);
    saveThreads(threadsRef.current, foldersRef.current, id);
  }, [stopSpeaking]);

  const renameThread = useCallback((id: string, name: string) => {
    threadsRef.current = threadsRef.current.map((t) => t.id === id ? { ...t, name } : t);
    setThreads([...threadsRef.current]);
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, []);

  const deleteThread = useCallback((id: string) => {
    // Cannot delete last thread
    if (threadsRef.current.length <= 1) return;
    threadsRef.current = threadsRef.current.filter((t) => t.id !== id);
    setThreads([...threadsRef.current]);
    // If deleting active thread, switch to first available
    if (activeThreadRef.current === id) {
      const next = threadsRef.current[0];
      activeThreadRef.current = next.id;
      setActiveThreadId(next.id);
      messagesRef.current = next.messages;
      setMessages(next.messages);
    }
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, []);

  const moveThread = useCallback((threadId: string, folderId: string | null) => {
    threadsRef.current = threadsRef.current.map((t) => t.id === threadId ? { ...t, folderId } : t);
    setThreads([...threadsRef.current]);
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, []);

  const createFolder = useCallback((name: string) => {
    const folder: ChatFolder = { id: `folder-${newId()}`, name, createdAt: new Date().toISOString() };
    foldersRef.current = [...foldersRef.current, folder];
    setFolders([...foldersRef.current]);
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, []);

  const renameFolder = useCallback((id: string, name: string) => {
    foldersRef.current = foldersRef.current.map((f) => f.id === id ? { ...f, name } : f);
    setFolders([...foldersRef.current]);
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, []);

  const deleteFolder = useCallback((id: string) => {
    // Move all threads in this folder to root before deleting
    threadsRef.current = threadsRef.current.map((t) => t.folderId === id ? { ...t, folderId: null } : t);
    foldersRef.current = foldersRef.current.filter((f) => f.id !== id);
    setThreads([...threadsRef.current]);
    setFolders([...foldersRef.current]);
    saveThreads(threadsRef.current, foldersRef.current, activeThreadRef.current);
  }, []);

  return (
    <AERAContext.Provider value={{
      isOpen, togglePanel, openPanel, closePanel,
      messages, addUserMessage, isTyping,
      isSpeaking, speakingMessageId, speak, speakMultiAgent, stopSpeaking, unlockAudio,
      ttsSpeed, setTtsSpeed,
      voiceMode, toggleVoiceMode,
      clearHistory,
      selectedAgentId,
      threads, folders, activeThreadId,
      createThread, createFolder, switchThread,
      renameThread, deleteThread, renameFolder, deleteFolder, moveThread,
    }}>
      {children}
    </AERAContext.Provider>
  );
}

export function useAERA() {
  const ctx = useContext(AERAContext);
  if (!ctx) throw new Error("useAERA must be used within AERAProvider");
  return ctx;
}
