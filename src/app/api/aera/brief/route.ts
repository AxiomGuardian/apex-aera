import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeText } from "@/lib/ai/llm";

/** GET: two sentences on what needs the person today. Proactive AERA. */
export async function GET() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ data: proposed }, { data: due }, { data: uploaded }, { data: pastDue }, { data: mems }] = await Promise.all([
    supabase.from("scheduled_posts").select("id,platform,scheduled_at,content_assets(title),brands(name)").eq("status", "proposed").order("scheduled_at").limit(5),
    supabase.from("scheduled_posts").select("id,platform,scheduled_at,content_assets(title),brands(name)").in("status", ["approved", "locked"]).lte("scheduled_at", new Date(Date.now() + 24 * 3600 * 1000).toISOString()).order("scheduled_at").limit(5),
    supabase.from("content_assets").select("id,title,status,brands(name)").gte("created_at", since).limit(5),
    supabase.from("brands").select("name").eq("billing_status", "past_due").limit(3),
    supabase.from("aera_memories").select("note").order("created_at", { ascending: false }).limit(8),
  ]);
  const facts = [
    `Waiting for a yes: ${(proposed ?? []).map((p) => `${(p as { content_assets?: { title?: string } }).content_assets?.title ?? "Untitled"} to ${p.platform} at ${p.scheduled_at}`).join("; ") || "none"}`,
    `Going out in the next 24h: ${(due ?? []).map((p) => `${(p as { content_assets?: { title?: string } }).content_assets?.title ?? "Untitled"} to ${p.platform}`).join("; ") || "none"}`,
    `Uploaded in the last 24h: ${(uploaded ?? []).map((a) => `${a.title ?? "Untitled"} (${a.status})`).join("; ") || "none"}`,
    `Past due billing: ${(pastDue ?? []).map((b) => b.name).join(", ") || "none"}`,
    `Remembered: ${(mems ?? []).map((m) => m.note).join("; ") || "nothing"}`,
  ].join("\n");

  const text = await completeText({
    system: "You are AERA. Write a spoken daily brief for the person running this brand: at most two short sentences, warm and specific, no lists, no markdown, no em dashes. If nothing needs them, say so and offer one concrete idea for a post today. Spell your name AERA.",
    messages: [{ role: "user", content: facts }],
    maxTokens: 120,
  });
  return NextResponse.json({ brief: text.trim(), counts: { proposed: proposed?.length ?? 0, due: due?.length ?? 0, uploaded: uploaded?.length ?? 0 } });
}
