import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { completeText } from "@/lib/ai/llm";
import { parseJson } from "@/lib/engines/core";
import { logServer } from "@/lib/log/server";

/**
 * Lead finder. Point it at a city and a trade and it goes looking for real local
 * businesses, then judges each one on how weak their social presence is, because
 * a business already posting well every day is not the one to call.
 *
 * POST { city, industry, count? }  -> runs a search, saves what it finds
 * GET  ?status=&limit=             -> the pipeline
 * PATCH { id, status?, notes? }    -> work a lead
 *
 * Agency and enterprise admins only. Everything comes from the open web via live
 * search; nothing is scraped from anywhere that forbids it.
 */

export const maxDuration = 120;

type Found = {
  name: string;
  category?: string;
  city?: string;
  state?: string;
  website?: string;
  phone?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  followers?: number;
  presence?: string;
  gap?: string;
  pitch?: string;
  score?: number;
};

async function requireAgency() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  if (me?.role !== "agency_admin" && me?.role !== "enterprise_admin") {
    return { error: NextResponse.json({ error: "Agency access required" }, { status: 403 }) };
  }
  return { supabase, userId: u.user.id };
}

export async function GET(request: Request) {
  const ctx = await requireAgency();
  if ("error" in ctx) return ctx.error;
  const p = new URL(request.url).searchParams;
  const limit = Math.min(Number(p.get("limit") ?? 100) || 100, 300);

  let q = ctx.supabase!.from("leads").select("*").order("score", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
  const status = p.get("status");
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leads: data ?? [] });
}

export async function PATCH(request: Request) {
  const ctx = await requireAgency();
  if ("error" in ctx) return ctx.error;
  const { id, status, notes } = (await request.json()) as { id?: string; status?: string; notes?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (status) patch.status = status;
  if (notes !== undefined) patch.notes = notes;

  const { error } = await ctx.supabase!.from("leads").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  void logServer(ctx.userId!, { event: "lead.update", area: "leads", label: "Moved a lead to " + (status ?? "a new note"), detail: { id, status } });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const ctx = await requireAgency();
  if ("error" in ctx) return ctx.error;

  const { city, industry, count } = (await request.json()) as { city?: string; industry?: string; count?: number };
  if (!city?.trim()) return NextResponse.json({ error: "A city or area is required" }, { status: 400 });
  const trade = industry?.trim() || "small local businesses";
  const want = Math.min(Math.max(count ?? 8, 3), 15);
  const started = Date.now();

  const system = `You find real local businesses that would benefit from having their social media run for them, and you are honest about what you actually found.

Rules:
- Use live search. Every business must be a real, currently operating business you found evidence for. Never invent one.
- Skip national chains and franchises. Owner operated only.
- The whole point is the gap. A business posting daily with strong engagement is a bad lead. A business with no account, an abandoned account, or a handful of posts a year is a good lead.
- If you cannot verify a detail, leave that field out rather than guessing. An empty field is fine. A made up phone number is not.
- score is 0 to 100 for how much they need this: 90 means a real business with almost no social presence, 20 means they already post well.

Answer with JSON only, no markdown fence, in this shape:
{"leads":[{"name":"","category":"","city":"","state":"","website":"","phone":"","instagram":"@handle or empty","tiktok":"","facebook":"","followers":0,"presence":"one sentence on what their social actually looks like today","gap":"one sentence on the specific opportunity","pitch":"one sentence you could open a cold call with","score":0}]}`;

  const ask = `Find ${want} ${trade} in or near ${city.trim()} that have a weak or missing social media presence. Check their websites and their Instagram, TikTok and Facebook. For each one, tell me what their presence looks like right now and why they are worth calling.`;

  let found: Found[] = [];
  let raw = "";
  try {
    raw = await completeText({ system, messages: [{ role: "user", content: ask }], liveSearch: true, maxTokens: 3000 });
    const parsed = parseJson<{ leads?: Found[] }>(raw);
    found = Array.isArray(parsed.leads) ? parsed.leads : [];
  } catch (e) {
    void logServer(ctx.userId!, { event: "lead.search", area: "leads", ok: false, ms: Date.now() - started, label: "Lead search failed for " + city, detail: { error: e instanceof Error ? e.message : String(e), preview: raw.slice(0, 400) } });
    return NextResponse.json({ error: "The search came back in a shape I could not read. Try a narrower city or trade." }, { status: 502 });
  }

  const clean = found
    .filter((l) => l.name && String(l.name).trim().length > 1)
    .slice(0, want)
    .map((l) => ({
      created_by: ctx.userId!,
      name: String(l.name).trim().slice(0, 120),
      category: l.category?.slice(0, 80) ?? trade.slice(0, 80),
      city: l.city?.slice(0, 80) ?? city.trim().slice(0, 80),
      state: l.state?.slice(0, 40) ?? null,
      website: l.website?.slice(0, 300) ?? null,
      phone: l.phone?.slice(0, 40) ?? null,
      instagram: l.instagram?.slice(0, 120) ?? null,
      tiktok: l.tiktok?.slice(0, 120) ?? null,
      facebook: l.facebook?.slice(0, 200) ?? null,
      followers: typeof l.followers === "number" && isFinite(l.followers) ? Math.max(0, Math.round(l.followers)) : null,
      presence: l.presence?.slice(0, 400) ?? null,
      gap: l.gap?.slice(0, 400) ?? null,
      pitch: l.pitch?.slice(0, 400) ?? null,
      score: typeof l.score === "number" ? Math.min(100, Math.max(0, Math.round(l.score))) : 50,
      search_id: crypto.randomUUID(),
      source: "search",
    }));

  if (!clean.length) {
    return NextResponse.json({ error: "Nothing came back for that search. Try a bigger city or a different trade." }, { status: 404 });
  }

  // Same business twice is not a new lead. Dedupe inside the batch, then against
  // what is already in the pipeline, then insert only what is genuinely new.
  const key = (n: string, c: string | null) => `${n.toLowerCase()}|${(c ?? "").toLowerCase()}`;
  const batch = new Map<string, (typeof clean)[number]>();
  for (const l of clean) if (!batch.has(key(l.name, l.city))) batch.set(key(l.name, l.city), l);

  const { data: existing } = await ctx.supabase!.from("leads").select("name,city");
  const already = new Set((existing ?? []).map((r) => key((r.name as string) ?? "", (r.city as string) ?? null)));
  const fresh = [...batch.values()].filter((l) => !already.has(key(l.name, l.city)));

  if (!fresh.length) {
    void logServer(ctx.userId!, { event: "lead.search", area: "leads", ok: true, ms: Date.now() - started, label: "Searched " + city + ", all already in the pipeline", detail: { city, trade, found: clean.length, added: 0 } });
    return NextResponse.json({ ok: true, added: 0, leads: [], note: "Everything that came back is already in your pipeline." });
  }

  const { data: saved, error } = await ctx.supabase!.from("leads").insert(fresh).select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  void logServer(ctx.userId!, { event: "lead.search", area: "leads", ok: true, ms: Date.now() - started, label: "Found " + (saved?.length ?? 0) + " leads in " + city, detail: { city, trade, added: saved?.length ?? 0, seen: clean.length } });
  return NextResponse.json({ ok: true, added: saved?.length ?? 0, leads: saved ?? [] });
}
