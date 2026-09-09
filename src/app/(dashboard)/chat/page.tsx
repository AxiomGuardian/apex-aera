"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowUp, Mic, MicOff, X, Loader2, ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/layout/SessionProvider";
import { PagePad } from "@/components/layout/PagePad";
import { ApexMark } from "@/components/chat/ApexMark";
import { DictateButton } from "@/components/voice/DictateButton";
import { useAeraVoice, AERA_VOICES, type UIDirective } from "@/components/aera/useAeraVoice";

/**
 * AERA. One brain (tools, memory, sight, search), private threads shared with the phone,
 * dictation in the composer, and the voice layer up top. Same look as the app.
 */

type Thread = { id: string; name: string | null; updated_at: string | null };
type Msg = { id: string; role: "user" | "aera"; content: string };

const TAB_HREF: Record<string, string> = { dashboard: "/dashboard", clients: "/clients", brand: "/brand", content: "/content", queue: "/approvals", aera: "/chat" };

export default function AERAPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const supabase = createClient();
  const uid = session?.user?.id as string | undefined;
  const role = session?.user?.role as string | undefined;
  const seesClients = role === "agency_admin" || role === "enterprise_admin";

  const [threads, setThreads] = useState<Thread[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [voiceId, setVoiceId] = useState(AERA_VOICES[0].id);
  const [voiceMenu, setVoiceMenu] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const voiceRef = useRef(voiceId);
  voiceRef.current = voiceId;

  useEffect(() => { try { const v = localStorage.getItem("aera.voice"); if (v) setVoiceId(v); } catch { /* ignore */ } }, []);
  const pickVoice = (id: string) => { setVoiceId(id); setVoiceMenu(false); try { localStorage.setItem("aera.voice", id); } catch { /* ignore */ } };

  // ── Threads ────────────────────────────────────────────────
  const loadThreads = useCallback(async () => {
    const { data } = await supabase.from("aera_threads").select("id,name,updated_at").order("updated_at", { ascending: false }).limit(60);
    const list = (data ?? []) as Thread[];
    setThreads(list);
    return list;
  }, [supabase]);

  const openThread = useCallback(async (t: Thread) => {
    setThread(t); setPendingConfirm(false);
    const { data } = await supabase.from("aera_messages").select("msg_id,role,content,created_at").eq("session_id", t.id).order("created_at").limit(300);
    setMessages(((data ?? []) as { msg_id: string | null; role: string; content: string }[]).map((m, i) => ({ id: m.msg_id ?? String(i), role: m.role === "user" ? "user" : "aera", content: m.content })));
  }, [supabase]);

  const newThread = useCallback(async () => {
    if (!uid) return;
    const t: Thread = { id: "thread-" + crypto.randomUUID(), name: "New chat", updated_at: new Date().toISOString() };
    await supabase.from("aera_threads").insert({ id: t.id, user_id: uid, name: t.name });
    setThreads((p) => [t, ...p]); setThread(t); setMessages([]); setPendingConfirm(false);
  }, [supabase, uid]);

  const deleteThread = useCallback(async (t: Thread) => {
    await supabase.from("aera_messages").delete().eq("session_id", t.id);
    await supabase.from("aera_threads").delete().eq("id", t.id);
    const rest = threads.filter((x) => x.id !== t.id);
    setThreads(rest);
    if (thread?.id === t.id) { if (rest[0]) void openThread(rest[0]); else void newThread(); }
  }, [supabase, threads, thread, openThread, newThread]);

  useEffect(() => {
    if (!uid) return;
    void (async () => { const list = await loadThreads(); if (list[0]) await openThread(list[0]); else await newThread(); })();
  }, [uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  const persist = useCallback(async (m: Msg) => {
    if (!uid || !thread) return;
    await supabase.from("aera_messages").insert({ user_id: uid, session_id: thread.id, role: m.role, content: m.content, msg_id: m.id });
    await supabase.from("aera_threads").update({ updated_at: new Date().toISOString() }).eq("id", thread.id);
  }, [supabase, uid, thread]);

  const applyDirective = useCallback((d: UIDirective) => {
    if (d.type === "navigate" && d.tab) {
      let tab = d.tab;
      if (!seesClients && (tab === "dashboard" || tab === "clients")) tab = "brand";
      if (seesClients && tab === "brand") tab = "clients";
      if (tab !== "aera") router.push(TAB_HREF[tab] ?? "/dashboard");
    }
  }, [router, seesClients]);

  // ── Send (same brain as the phone and the voice layer) ─────
  const send = useCallback(async (confirm = false) => {
    const text = draft.trim();
    if (!text || thinking || !thread) return;
    setDraft(""); setPendingConfirm(false);
    const mine: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, mine]); void persist(mine);
    if (messages.length === 0) { void supabase.from("aera_threads").update({ name: text.slice(0, 40) }).eq("id", thread.id).then(() => loadThreads()); }
    setThinking(true);
    try {
      const history = [...messages, mine].slice(-16).map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content }));
      const r = await fetch("/api/aera/act", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, confirm }) });
      const j = (await r.json()) as { say?: string; ui?: UIDirective[]; needsConfirm?: unknown };
      for (const d of j.ui ?? []) applyDirective(d);
      if (j.needsConfirm) setPendingConfirm(true);
      const reply: Msg = { id: crypto.randomUUID(), role: "aera", content: j.say ?? "Done." };
      setMessages((p) => [...p, reply]); void persist(reply);
    } catch {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "aera", content: "I could not reach the server just now." }]);
    }
    setThinking(false);
  }, [draft, thinking, thread, messages, persist, supabase, loadThreads, applyDirective]);

  // ── Voice layer ────────────────────────────────────────────
  const voice = useAeraVoice({
    voice: () => voiceRef.current,
    onDirective: applyDirective,
    onExchange: (u, a) => {
      const m1: Msg = { id: crypto.randomUUID(), role: "user", content: u };
      const m2: Msg = { id: crypto.randomUUID(), role: "aera", content: a };
      setMessages((p) => [...p, m1, m2]); void persist(m1); void persist(m2);
    },
  });

  const starters = seesClients
    ? ["What is trending across my clients this week?", "What is waiting in the queue?", "Give me a report on every brand."]
    : ["What is trending for my brand this week?", "What is in my queue?", "What should I post next?"];

  return (
    <PagePad>
      <div className="flex flex-col gap-5 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards", height: "calc(100vh - 140px)", minHeight: 560 }}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="auth-mark" style={{ width: 52, height: 52 }}><ApexMark size={22} /></div>
            <div>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "0.12em", color: "var(--text)", lineHeight: 1 }}>AERA</h2>
              <p style={{ fontSize: 12.5, color: "var(--text-4)", marginTop: 5 }}>{voice.active ? (voice.state === "listening" ? (voice.muted ? "Muted" : "Listening") : voice.state === "thinking" ? "Thinking" : voice.state === "speaking" ? "Speaking" : "Voice") : thinking ? "Thinking" : "Awake. I can see your brands, your queue, and your content."}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Voice picker */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setVoiceMenu((v) => !v)} className="dash-btn" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 13px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
                Voice: {AERA_VOICES.find((v) => v.id === voiceId)?.name ?? "Thalia"} <ChevronDown style={{ width: 12, height: 12 }} />
              </button>
              {voiceMenu && (
                <div style={{ position: "absolute", right: 0, top: "110%", zIndex: 30, width: 280, borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border-mid)", boxShadow: "var(--shadow-lg)", padding: 6 }}>
                  {AERA_VOICES.map((v) => (
                    <button key={v.id} onClick={() => pickVoice(v.id)} className="dash-row" style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 10px", borderRadius: 9, background: v.id === voiceId ? "var(--cyan-subtle)" : "transparent", border: "none", cursor: "pointer" }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: v.id === voiceId ? "var(--cyan)" : "var(--text-2)" }}>{v.name}</p>
                      <p style={{ fontSize: 11.5, color: "var(--text-5)" }}>{v.note}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => (voice.active ? voice.close() : voice.open())} className="mkt-btn dash-btn" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", borderRadius: 10, background: voice.active ? "var(--cyan-subtle)" : "rgba(45,212,255,0.08)", border: "1px solid " + (voice.active ? "var(--cyan)" : "rgba(45,212,255,0.25)"), color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              <ApexMark size={14} /> {voice.active ? "End voice" : "Talk to AERA"}
            </button>
          </div>
        </div>

        {/* Voice capsule */}
        {voice.active && (
          <div className="mkt-card mkt-line-cyan" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px" }}>
            <button onClick={voice.interrupt} title="Interrupt" className="auth-mark" style={{ width: 38, height: 38, border: "none", cursor: "pointer" }}><ApexMark size={14} /></button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--cyan-text)" }}>{voice.state === "listening" ? (voice.muted ? "Muted" : "Listening") : voice.state === "thinking" ? "Thinking" : voice.state === "speaking" ? "AERA" : "Voice"}</p>
              <p style={{ fontSize: 13.5, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{voice.state === "speaking" ? voice.said : voice.heard || (voice.state === "listening" ? "I am listening." : "")}</p>
              {voice.error && <p style={{ fontSize: 11, color: "var(--rose)" }}>{voice.error}</p>}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <span key={i} style={{ width: 3, borderRadius: 2, background: "var(--cyan)", height: 4 + (voice.state === "listening" || voice.state === "speaking" ? (Math.sin(Date.now() / 120 + i) * 0.5 + 0.5) * (voice.state === "speaking" ? 14 : voice.level * 22) : 0), transition: "height 0.1s" }} />
              ))}
            </div>
            <button onClick={voice.toggleMute} title={voice.muted ? "Unmute" : "Mute mic"} style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid " + (voice.muted ? "rgba(251,113,133,0.5)" : "var(--border)"), background: voice.muted ? "rgba(251,113,133,0.12)" : "var(--surface-2)", color: voice.muted ? "var(--rose)" : "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {voice.muted ? <MicOff style={{ width: 14, height: 14 }} /> : <Mic style={{ width: 14, height: 14 }} />}
            </button>
            <button onClick={voice.close} title="End" style={{ width: 34, height: 34, borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-3)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X style={{ width: 14, height: 14 }} /></button>
          </div>
        )}

        {/* Body: threads + conversation */}
        <div className="grid gap-5" style={{ gridTemplateColumns: "260px 1fr", flex: 1, minHeight: 0 }}>
          {/* Threads */}
          <div className="mkt-card mkt-quiet" style={{ padding: 14, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <button onClick={() => void newThread()} className="mkt-btn dash-btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 14px", borderRadius: 10, background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.25)", color: "var(--cyan)", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 12 }}>
              <Plus style={{ width: 14, height: 14 }} /> New chat
            </button>
            <p className="section-label" style={{ marginBottom: 8 }}>Your chats</p>
            <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              {threads.map((t) => (
                <div key={t.id} className="dash-row" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", borderRadius: 10, background: thread?.id === t.id ? "var(--cyan-subtle)" : "transparent", border: "1px solid " + (thread?.id === t.id ? "var(--cyan-border)" : "transparent") }}>
                  <button onClick={() => void openThread(t)} style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: thread?.id === t.id ? "var(--cyan)" : "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name ?? "Chat"}</p>
                  </button>
                  <button onClick={() => { if (confirm("Delete this chat?")) void deleteThread(t); }} title="Delete" style={{ background: "none", border: "none", color: "var(--text-6)", cursor: "pointer", padding: 2 }}><Trash2 style={{ width: 13, height: 13 }} /></button>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 10, lineHeight: 1.5 }}>Private to your account. Shared with your phone.</p>
          </div>

          {/* Conversation */}
          <div className="mkt-card mkt-quiet" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              {messages.length === 0 && !thinking && (
                <div style={{ textAlign: "center", padding: "56px 20px 20px" }}>
                  <div className="auth-mark" style={{ width: 64, height: 64, margin: "0 auto 14px" }}><ApexMark size={26} /></div>
                  <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text)" }}>Ask me anything about your brand.</p>
                  <p style={{ fontSize: 13, color: "var(--text-4)", marginTop: 6, maxWidth: 420, marginInline: "auto" }}>I can look at your content, search what is trending, and change things in your queue.</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 18 }}>
                    {starters.map((s) => (
                      <button key={s} onClick={() => { setDraft(s); setTimeout(() => void send(), 0); }} className="dash-btn" style={{ padding: "9px 14px", borderRadius: 999, background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.25)", color: "var(--cyan-text)", fontSize: 13, cursor: "pointer" }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
                  {m.role === "aera" && <ApexMark size={14} opacity={0.8} />}
                  <div style={{ maxWidth: "72%", padding: "12px 16px", borderRadius: 18, fontSize: 15, lineHeight: 1.55, whiteSpace: "pre-wrap", background: m.role === "user" ? "var(--cyan)" : "var(--surface-2)", color: m.role === "user" ? "#04131a" : "var(--text)", border: m.role === "user" ? "none" : "1px solid var(--border)" }}>{m.content}</div>
                </div>
              ))}
              {thinking && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-5)", fontSize: 12.5 }}><Loader2 className="animate-spin" style={{ width: 14, height: 14, color: "var(--cyan)" }} /> AERA is thinking</div>}
              {pendingConfirm && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => { setDraft("yes"); void send(true); }} className="dash-btn" style={{ padding: "8px 14px", borderRadius: 9, background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", color: "var(--green)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>Yes, do it</button>
                  <button onClick={() => { setPendingConfirm(false); setMessages((p) => [...p, { id: crypto.randomUUID(), role: "aera", content: "Okay, leaving it as is." }]); }} className="dash-btn" style={{ padding: "8px 14px", borderRadius: 9, background: "transparent", border: "1px solid var(--border)", color: "var(--text-4)", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>No</button>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            {/* Composer */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: 14, borderTop: "1px solid var(--border)", background: "var(--surface)" }}>
              <DictateButton size={42} title="Dictate" onText={(t) => setDraft((d) => (d ? d + " " + t : t))} />
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Talk to AERA" rows={1}
                style={{ flex: 1, resize: "none", padding: "12px 14px", borderRadius: 12, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 14.5, outline: "none", maxHeight: 140, fontFamily: "inherit" }} />
              <button onClick={() => void send()} disabled={!draft.trim() || thinking} className="mkt-btn dash-btn" style={{ width: 42, height: 42, borderRadius: 999, border: "none", background: "var(--cyan)", color: "#04131a", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: !draft.trim() || thinking ? 0.5 : 1 }}>
                <ArrowUp style={{ width: 16, height: 16 }} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </PagePad>
  );
}
