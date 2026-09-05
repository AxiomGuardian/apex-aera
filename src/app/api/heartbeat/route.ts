import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";
import { analyzeAsset } from "@/lib/engines/analyzer";
import { generateCaptions } from "@/lib/engines/captioner";
import { scheduleAsset } from "@/lib/engines/scheduler";
import { publishDue } from "@/lib/engines/publisher";
import { generateTrendBrief, getFreshBrief } from "@/lib/engines/trends";
import { checkConnections } from "@/lib/engines/health";
import { runLifecycle } from "@/lib/brands/lifecycle";

/**
 * The Heartbeat — APEX AERA's 24/7 autonomy loop.
 * Each beat, for every autopilot brand:
 *   1. Analyze fresh uploads (capped per beat)
 *   2. Caption + schedule analyzed content
 *   3. Publish anything due
 * Callable by: a signed-in agency admin (dashboard button) or cron
 * (x-heartbeat-secret header / Vercel CRON_SECRET bearer).
 */

async function authorize(request: Request): Promise<boolean> {
  const secret = request.headers.get("x-heartbeat-secret");
  if (secret && secret === process.env.HEARTBEAT_SECRET) return true;
  const bearer = request.headers.get("authorization");
  if (process.env.CRON_SECRET && bearer === `Bearer ${process.env.CRON_SECRET}`) return true;
  try {
    const supabase = await createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return false;
    const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
    return prof?.role === "agency_admin";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = adminClient();
  let analyzed = 0, captioned = 0, scheduled = 0, trends = 0;
  const errors: string[] = [];

  const { data: brands } = await sb.from("brands").select("id,name").eq("autopilot", true).eq("status", "active");

  for (const brand of brands ?? []) {
    // 0) Weekly trend research (only when the brief is stale)
    try {
      const fresh = await getFreshBrief(sb, brand.id);
      if (!fresh) {
        await generateTrendBrief(sb, brand.id);
        trends++;
      }
    } catch (e) {
      errors.push(`trends ${brand.name}: ${e instanceof Error ? e.message : "failed"}`);
    }

    // 1) Analyze fresh uploads (max 2 per brand per beat)
    const { data: uploads } = await sb
      .from("content_assets").select("id").eq("brand_id", brand.id).eq("status", "uploaded")
      .order("created_at").limit(2);
    for (const a of uploads ?? []) {
      try { await analyzeAsset(sb, a.id); analyzed++; }
      catch (e) { errors.push(`analyze ${brand.name}: ${e instanceof Error ? e.message : "failed"}`); }
    }

    // 2) Caption + schedule analyzed assets (max 3 per brand per beat)
    const { data: ready } = await sb
      .from("content_assets").select("id").eq("brand_id", brand.id).eq("status", "analyzed")
      .order("created_at").limit(3);
    for (const a of ready ?? []) {
      try {
        const { data: existing } = await sb.from("captions").select("id").eq("asset_id", a.id).limit(1);
        if (!existing?.length) { await generateCaptions(sb, a.id); captioned++; }
        await scheduleAsset(sb, a.id);
        scheduled++;
      } catch (e) {
        errors.push(`schedule ${brand.name}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  }

  // 3) Connection health (rolling, every 6h per connection)
  const health = await checkConnections(sb);

  // 4) Publish anything due
  const pub = await publishDue(sb);

  // 5) Lifecycle sweep: billing grace, inactivity, archive warnings, purges
  const life = await runLifecycle(sb);

  const summary = `trends ${trends}, analyzed ${analyzed}, captioned ${captioned}, scheduled ${scheduled}, due ${pub.due} (published ${pub.published}, awaiting platform connections ${pub.blocked}), connections checked ${health.checked} (expired ${health.expired}), lifecycle (archived ${life.pastDueArchived + life.inactiveArchived}, warned ${life.purgeWarned + life.inactiveNoticed}, purged ${life.purged})`;
  return NextResponse.json({ ok: true, summary, trends, analyzed, captioned, scheduled, health, publish: pub, lifecycle: life, errors });
}

export async function GET(request: Request) {
  return POST(request);
}
