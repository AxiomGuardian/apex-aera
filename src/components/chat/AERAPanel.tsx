"use client";

/**
 * AERAPanel — the quick ask drawer.
 *
 * Same brain as /chat and the phone: /api/aera/act with tools, memory and sight.
 * Kept small on purpose: a running thread named "Quick ask" that syncs to the
 * phone, dictation in the box, and the voice layer one tap away.
 * Deep work goes to /chat.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUp, Mic, MicOff, Loader2, Maximize2, Eraser } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/layout/SessionProvider";
import { useAERA } from "@/context/AERAContext";
import { ApexMark } from "./ApexMark";
import { DictateButton } from "@/components/voice/DictateButton";
import { useAeraVoice, type UIDirective } from "@/components/aera/useAeraVoice";
import { askAera } from "@/lib/aera/stream";
import { StepTrail } from "@/components/aera/StepTrail";
import type { Step } from "@/lib/aera/steps";
import { log } from "@/lib/log/client";

type Msg = { id: string; role: "user" | "aera"; content: string; steps?: Step[] };

const TAB_HREF: Record<string, string> = {
  dashboard: "/dashboard",
  clients: "/clients",
  brand: "/brand",
  content: "/content",
  queue: "/approvals",
  aera: "/chat",
};

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

export function AERAPanel() {
  const { isOpen, closePanel } = useAERA();
  const { data: session } = useSession();
  const router = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const uid = session?.user?.id as string | undefined;
  const role = session?.user?.role as string | undefined;
  const seesClients = role === "agency_admin" || role === "enterprise_admin";

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [phase, setPhase] = useState("Thinking");
  const [liveSteps, setLiveSteps] = useState<Step[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const threadId = uid ? `quickask-${uid}` : null;
  const voiceRef = useRef("aura-2-thalia-en");
  useEffect(() => {
    try {
      const v = localStorage.getItem("aera.voice");
      if (v) voiceRef.current = v;
    } catch { /* ignore */ }
  }, [isOpen]);

  // The quick ask thread (same tables as /chat and the phone)
  useEffect(() => {
    if (!isOpen || !uid || !threadId || ready) return;
    void (async () => {
      await supabase.from("aera_threads").upsert({ id: threadId, user_id: uid, name: "Quick ask" }, { onConflict: "id" });
      const { data } = await supabase
        .from("aera_messages")
        .select("msg_id,role,content,created_at")
        .eq("session_id", threadId)
        .order("created_at", { ascending: false })
        .limit(20);
      const rows = ((data ?? []) as { msg_id: string | null; role: string; content: string }[]).reverse();
      setMessages(rows.map((m, i) => ({ id: m.msg_id ?? String(i), role: m.role === "user" ? "user" : "aera", content: m.content })));
      setReady(true);
    })();
  }, [isOpen, uid, threadId, ready, supabase]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking, isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    log("panel.open", { area: "chat", label: "Opened the quick ask panel" });
    const t = setTimeout(() => inputRef.current?.focus(), 380);
    return () => clearTimeout(t);
  }, [isOpen]);

  const persist = useCallback(async (m: Msg) => {
    if (!uid || !threadId) return;
    await supabase.from("aera_messages").insert({ user_id: uid, session_id: threadId, role: m.role, content: m.content, msg_id: m.id });
    await supabase.from("aera_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
  }, [supabase, uid, threadId]);

  const applyDirective = useCallback((d: UIDirective) => {
    if (d.type === "navigate" && d.tab) {
      let tab = d.tab;
      if (!seesClients && (tab === "dashboard" || tab === "clients")) tab = "brand";
      if (seesClients && tab === "brand") tab = "clients";
      if (tab === "aera") { router.push("/chat"); closePanel(); return; }
      router.push(TAB_HREF[tab] ?? "/dashboard");
    }
  }, [router, seesClients, closePanel]);

  const ask = useCallback(async (text: string, confirm = false) => {
    const body = text.trim();
    if (!body || thinking) return;
    setDraft(""); setPendingConfirm(false);
    const mine: Msg = { id: crypto.randomUUID(), role: "user", content: body };
    setMessages((p) => [...p, mine]); void persist(mine);
    setThinking(true); setPhase("Thinking"); setLiveSteps([]);
    const history = [...messages, mine].slice(-12).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
    const done = await askAera(history, {
      confirm,
      onPhase: (label) => setPhase(label),
      onStep: (st) => setLiveSteps((p) => [...p, st]),
    });
    for (const d of done.ui ?? []) applyDirective(d as UIDirective);
    if (done.needsConfirm) setPendingConfirm(true);
    const reply: Msg = { id: crypto.randomUUID(), role: "aera", content: done.say, steps: done.steps };
    setMessages((p) => [...p, reply]); void persist(reply);
    setLiveSteps([]);
    setThinking(false);
  }, [thinking, messages, persist, applyDirective]);

  // Voice layer
  const voice = useAeraVoice({
    voice: () => voiceRef.current,
    onDirective: applyDirective,
    onExchange: (u, a) => {
      const m1: Msg = { id: crypto.randomUUID(), role: "user", content: u };
      const m2: Msg = { id: crypto.randomUUID(), role: "aera", content: a };
      setMessages((p) => [...p, m1, m2]); void persist(m1); void persist(m2);
    },
  });

  useEffect(() => { if (!isOpen && voice.active) voice.close(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearThread = useCallback(async () => {
    if (!threadId) return;
    setMessages([]); setPendingConfirm(false);
    await supabase.from("aera_messages").delete().eq("session_id", threadId);
  }, [supabase, threadId]);

  const starters = seesClients
    ? ["What is in the queue?", "What is trending this week?", "Give me today's brief."]
    : ["What is in my queue?", "What should I post next?", "Give me today's brief."];

  const status = voice.active
    ? (voice.state === "listening" ? (voice.muted ? "Muted" : "Listening") : voice.state === "thinking" ? "Thinking" : voice.state === "speaking" ? "Speaking" : "Voice")
    : thinking ? "Thinking" : "Quick ask";

  const slide = isMobile
    ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
    : { initial: { x: 420, opacity: 0 }, animate: { x: 0, opacity: 1 }, exit: { x: 420, opacity: 0 } };

  const panelStyle: React.CSSProperties = isMobile
    ? {
        position: "fixed", left: 0, right: 0, bottom: 0, height: "88vh", zIndex: 60,
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "var(--surface)", borderTop: "1px solid var(--border-mid)",
        borderRadius: "20px 20px 0 0", boxShadow: "0 -18px 60px rgba(0,0,0,0.28)",
      }
    : {
        width: 380, minWidth: 380, maxWidth: 380, height: "100%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        background: "var(--surface)", borderLeft: "1px solid var(--border-mid)",
        boxShadow: "-24px 0 60px rgba(0,0,0,0.10)", position: "relative", zIndex: 20,
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {isMobile && (
            <motion.div
              key="aera-panel-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={closePanel}
              style={{ position: "fixed", inset: 0, zIndex: 59, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
            />
          )}

          <motion.aside
            key="aera-panel"
            initial={slide.initial} animate={slide.animate} exit={slide.exit}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
            style={panelStyle}
          >
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.55), transparent)", zIndex: 2 }} />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "14px 16px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <div className="auth-mark" style={{ width: 38, height: 38 }}><ApexMark size={16} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, letterSpacing: "0.1em", color: "var(--text)", lineHeight: 1 }}>AERA</p>
                <p style={{ fontSize: 11.5, color: voice.active ? "var(--cyan-text)" : "var(--text-5)", marginTop: 4 }}>{status}</p>
              </div>

              <button
                onClick={() => (voice.active ? voice.close() : voice.open())}
                title={voice.active ? "End voice" : "Talk to AERA"}
                style={{
                  height: 32, padding: "0 12px", borderRadius: 9, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                  border: "1px solid " + (voice.active ? "var(--cyan)" : "rgba(45,212,255,0.25)"),
                  background: voice.active ? "var(--cyan-subtle)" : "rgba(45,212,255,0.07)",
                  color: "var(--cyan-text)", fontSize: 12, fontWeight: 700,
                }}
              >
                <Mic style={{ width: 13, height: 13 }} /> {voice.active ? "End" : "Talk"}
              </button>

              <button
                onClick={() => { closePanel(); router.push("/chat"); }}
                title="Open full conversation"
                style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <Maximize2 style={{ width: 13, height: 13 }} />
              </button>

              <button
                onClick={closePanel}
                title="Close"
                style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--border)", background: "transparent", color: "var(--text-4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* Voice capsule */}
            {voice.active && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 14px 0", padding: "10px 12px", borderRadius: 14, background: "var(--cyan-subtle)", border: "1px solid var(--cyan-border)", flexShrink: 0 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--cyan-text)" }}>
                    {voice.state === "listening" ? (voice.muted ? "Muted" : "Listening") : voice.state === "thinking" ? "Thinking" : voice.state === "speaking" ? "AERA" : "Voice"}
                  </p>
                  <p style={{ fontSize: 12.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                    {voice.state === "speaking" ? voice.said : voice.heard || (voice.state === "listening" ? "I am listening." : "")}
                  </p>
                  {voice.error && <p style={{ fontSize: 10.5, color: "var(--rose)" }}>{voice.error}</p>}
                </div>
                <button
                  onClick={voice.toggleMute}
                  title={voice.muted ? "Unmute" : "Mute mic"}
                  style={{ width: 30, height: 30, borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid " + (voice.muted ? "rgba(251,113,133,0.5)" : "var(--border)"), background: voice.muted ? "rgba(251,113,133,0.12)" : "var(--surface-2)", color: voice.muted ? "var(--rose)" : "var(--text-3)" }}
                >
                  {voice.muted ? <MicOff style={{ width: 13, height: 13 }} /> : <Mic style={{ width: 13, height: 13 }} />}
                </button>
                <button
                  onClick={voice.interrupt}
                  title="Interrupt"
                  style={{ width: 30, height: 30, borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)" }}
                >
                  <X style={{ width: 13, height: 13 }} />
                </button>
              </div>
            )}

            {/* Conversation */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
              {messages.length === 0 && !thinking && (
                <div style={{ padding: "26px 4px 6px" }}>
                  <p style={{ fontSize: 14.5, fontWeight: 700, color: "var(--text)" }}>Ask me anything, right here.</p>
                  <p style={{ fontSize: 12.5, color: "var(--text-5)", marginTop: 5, lineHeight: 1.55 }}>
                    I can see your brands, your queue and your content, and I can change things for you.
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 14 }}>
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => void ask(s)}
                        className="dash-btn"
                        style={{ textAlign: "left", padding: "10px 12px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 12.5, cursor: "pointer" }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 7 }}>
                  {m.role === "aera" && <ApexMark size={12} opacity={0.8} />}
                  <div style={{ maxWidth: "85%", display: "flex", flexDirection: "column", gap: 5, alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                    {m.role === "aera" && m.steps && m.steps.length > 0 && <StepTrail steps={m.steps} />}
                    <div
                      style={{
                        padding: "10px 13px", borderRadius: 15, fontSize: 13.5, lineHeight: 1.55, whiteSpace: "pre-wrap",
                        background: m.role === "user" ? "var(--cyan)" : "var(--surface-2)",
                        color: m.role === "user" ? "#04131a" : "var(--text)",
                        border: m.role === "user" ? "none" : "1px solid var(--border)",
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}

              {thinking && (
                <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-start" }}>
                  {liveSteps.length > 0 && <StepTrail steps={liveSteps} />}
                  <div style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-5)", fontSize: 12 }}>
                    <Loader2 className="animate-spin" style={{ width: 13, height: 13, color: "var(--cyan)" }} /> {phase}
                  </div>
                </div>
              )}

              {pendingConfirm && (
                <div style={{ display: "flex", gap: 7 }}>
                  <button onClick={() => void ask("yes", true)} className="dash-btn" style={{ padding: "7px 12px", borderRadius: 9, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "var(--green)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Yes, do it</button>
                  <button onClick={() => { setPendingConfirm(false); setMessages((p) => [...p, { id: crypto.randomUUID(), role: "aera", content: "Okay, leaving it as is." }]); }} className="dash-btn" style={{ padding: "7px 12px", borderRadius: 9, background: "transparent", border: "1px solid var(--border)", color: "var(--text-4)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>No</button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div style={{ padding: 12, borderTop: "1px solid var(--border)", flexShrink: 0, background: "var(--surface)" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <DictateButton size={38} title="Dictate" onText={(t) => setDraft((d) => (d ? d + " " + t : t))} />
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(draft); } }}
                  placeholder="Ask AERA"
                  rows={1}
                  style={{ flex: 1, resize: "none", padding: "10px 12px", borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13.5, outline: "none", maxHeight: 110, fontFamily: "inherit" }}
                />
                <button
                  onClick={() => void ask(draft)}
                  disabled={!draft.trim() || thinking}
                  className="mkt-btn dash-btn"
                  style={{ width: 38, height: 38, borderRadius: 999, border: "none", background: "var(--cyan)", color: "#04131a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: !draft.trim() || thinking ? 0.5 : 1, flexShrink: 0 }}
                >
                  <ArrowUp style={{ width: 15, height: 15 }} strokeWidth={2.5} />
                </button>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 9 }}>
                <button
                  onClick={() => { closePanel(); router.push("/chat"); }}
                  style={{ background: "none", border: "none", color: "var(--cyan-text)", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
                >
                  Open full conversation
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={() => { if (confirm("Clear this quick ask thread?")) void clearThread(); }}
                    title="Clear"
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: "var(--text-6)", fontSize: 11.5, cursor: "pointer", padding: 0 }}
                  >
                    <Eraser style={{ width: 12, height: 12 }} /> Clear
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
