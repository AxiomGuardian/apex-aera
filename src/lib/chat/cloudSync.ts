"use client";

/**
 * Cloud persistence for AERA chat.
 * Supabase is the source of truth when signed in; localStorage remains a
 * fast offline cache. Every write is fire-and-forget — chat and voice UX
 * never wait on the network.
 */

import { createClient } from "@/lib/supabase/client";
import type { ChatThread, ChatFolder, Message } from "@/context/AERAContext";

const GREETING_ID = "aera-intro";

function sb() {
  return createClient();
}

async function userId(): Promise<string | null> {
  try {
    const { data } = await sb().auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

type MsgRow = {
  msg_id: string;
  session_id: string;
  role: string;
  agent_id: string | null;
  content: string;
  thinking: string | null;
  chart: unknown;
  created_at: string;
};

function greeting(): Message {
  return {
    id: GREETING_ID,
    role: "aera",
    agentId: "aera",
    content: "Hey — what's on your mind?",
    timestamp: new Date(),
  };
}

/** Load all threads/folders/messages for the signed-in user. null = signed out/offline. */
export async function loadCloud(): Promise<{ threads: ChatThread[]; folders: ChatFolder[] } | null> {
  const uid = await userId();
  if (!uid) return null;
  try {
    const client = sb();
    const [f, t, m] = await Promise.all([
      client.from("aera_folders").select("id,name,created_at").order("created_at"),
      client.from("aera_threads").select("id,name,folder_id,created_at,updated_at").order("updated_at", { ascending: false }),
      client.from("aera_messages").select("msg_id,session_id,role,agent_id,content,thinking,chart,created_at").order("created_at"),
    ]);
    if (f.error || t.error || m.error) return null;

    const byThread = new Map<string, Message[]>();
    for (const r of (m.data ?? []) as MsgRow[]) {
      if (!r.msg_id) continue;
      const msg: Message = {
        id: r.msg_id,
        role: r.role === "user" ? "user" : "aera",
        content: r.content,
        agentId: (r.agent_id ?? undefined) as Message["agentId"],
        thinking: r.thinking,
        chart: (r.chart ?? null) as Message["chart"],
        timestamp: new Date(r.created_at),
      };
      const list = byThread.get(r.session_id) ?? [];
      list.push(msg);
      byThread.set(r.session_id, list);
    }

    const folders: ChatFolder[] = (f.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      createdAt: r.created_at,
    }));

    const threads: ChatThread[] = (t.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      folderId: r.folder_id,
      messages: [greeting(), ...(byThread.get(r.id) ?? [])],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return { threads, folders };
  } catch {
    return null;
  }
}

/** One-time upload of pre-cloud localStorage history (first signed-in load). */
export async function migrateLocal(threads: ChatThread[], folders: ChatFolder[]) {
  const uid = await userId();
  if (!uid) return;
  try {
    const client = sb();
    if (folders.length) {
      await client.from("aera_folders").upsert(
        folders.map((f) => ({ id: f.id, user_id: uid, name: f.name, created_at: f.createdAt })),
        { onConflict: "id" }
      );
    }
    if (!threads.length) return;
    await client.from("aera_threads").upsert(
      threads.map((t) => ({
        id: t.id,
        user_id: uid,
        folder_id: t.folderId,
        name: t.name,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      })),
      { onConflict: "id" }
    );
    const rows = threads.flatMap((t) =>
      t.messages
        .filter((msg) => msg.id !== GREETING_ID)
        .map((msg) => ({
          msg_id: msg.id,
          session_id: t.id,
          user_id: uid,
          brand_id: null,
          role: msg.role,
          agent_id: msg.agentId ?? null,
          content: msg.content,
          thinking: msg.thinking ?? null,
          chart: msg.chart ?? null,
          created_at: new Date(msg.timestamp).toISOString(),
        }))
    );
    for (let i = 0; i < rows.length; i += 200) {
      await client.from("aera_messages").upsert(rows.slice(i, i + 200), {
        onConflict: "msg_id",
        ignoreDuplicates: true,
      });
    }
  } catch {
    /* offline — local cache still holds it */
  }
}

/** Persist new messages in a thread (user, AERA, or fallback). */
export async function saveMessages(threadId: string, msgs: Message[]) {
  const uid = await userId();
  if (!uid) return;
  try {
    const client = sb();
    // Make sure the thread row exists (e.g. the default thread's first message)
    await client.from("aera_threads").upsert(
      { id: threadId, user_id: uid, name: "AERA Intelligence" },
      { onConflict: "id", ignoreDuplicates: true }
    );
    const rows = msgs
      .filter((m) => m.id !== GREETING_ID)
      .map((m) => ({
        msg_id: m.id,
        session_id: threadId,
        user_id: uid,
        brand_id: null,
        role: m.role,
        agent_id: m.agentId ?? null,
        content: m.content,
        thinking: m.thinking ?? null,
        chart: m.chart ?? null,
        created_at: new Date(m.timestamp).toISOString(),
      }));
    if (rows.length) {
      await client.from("aera_messages").upsert(rows, { onConflict: "msg_id", ignoreDuplicates: true });
      await client.from("aera_threads").update({ updated_at: new Date().toISOString() }).eq("id", threadId);
    }
  } catch {
    /* fire-and-forget */
  }
}

export async function upsertThread(t: ChatThread) {
  const uid = await userId();
  if (!uid) return;
  try {
    await sb().from("aera_threads").upsert(
      {
        id: t.id,
        user_id: uid,
        folder_id: t.folderId,
        name: t.name,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
      },
      { onConflict: "id" }
    );
  } catch { /* noop */ }
}

export async function renameThread(id: string, name: string) {
  try { await sb().from("aera_threads").update({ name }).eq("id", id); } catch { /* noop */ }
}

export async function deleteThread(id: string) {
  try {
    const client = sb();
    await client.from("aera_messages").delete().eq("session_id", id);
    await client.from("aera_threads").delete().eq("id", id);
  } catch { /* noop */ }
}

export async function moveThread(id: string, folderId: string | null) {
  try { await sb().from("aera_threads").update({ folder_id: folderId }).eq("id", id); } catch { /* noop */ }
}

export async function upsertFolder(f: ChatFolder) {
  const uid = await userId();
  if (!uid) return;
  try {
    await sb().from("aera_folders").upsert(
      { id: f.id, user_id: uid, name: f.name, created_at: f.createdAt },
      { onConflict: "id" }
    );
  } catch { /* noop */ }
}

export async function renameFolder(id: string, name: string) {
  try { await sb().from("aera_folders").update({ name }).eq("id", id); } catch { /* noop */ }
}

export async function deleteFolder(id: string) {
  try { await sb().from("aera_folders").delete().eq("id", id); } catch { /* noop */ }
}

/** Clear history inside a thread (keeps the thread row). */
export async function clearThreadMessages(threadId: string) {
  try { await sb().from("aera_messages").delete().eq("session_id", threadId); } catch { /* noop */ }
}
