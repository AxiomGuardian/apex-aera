import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Publishing engine (wireframe). Finds due posts and pushes them through
 * platform adapters. Until platform APIs are connected, posts stay queued
 * with an honest error — nothing is ever faked as "published".
 */

type Adapter = (post: { id: string; platform: string }) => Promise<{ ok: boolean; platformPostId?: string; error?: string }>;

// Platform adapters plug in here as OAuth connections are built (Meta first).
const ADAPTERS: Record<string, Adapter | undefined> = {};

export async function publishDue(sb: SupabaseClient) {
  const nowIso = new Date().toISOString();
  const { data: due } = await sb
    .from("scheduled_posts")
    .select("id,brand_id,platform,status,scheduled_at")
    .in("status", ["approved", "locked"])
    .lte("scheduled_at", nowIso)
    .limit(10);

  let published = 0, blocked = 0;
  for (const post of due ?? []) {
    const { data: conn } = await sb
      .from("platform_connections")
      .select("status")
      .eq("brand_id", post.brand_id)
      .eq("platform", post.platform)
      .eq("status", "connected")
      .maybeSingle();

    const adapter = ADAPTERS[post.platform];
    if (!conn || !adapter) {
      blocked++;
      await sb.from("scheduled_posts").update({
        error: "Awaiting platform connection — connect this platform in the client workspace to publish.",
      }).eq("id", post.id);
      continue;
    }

    await sb.from("scheduled_posts").update({ status: "publishing" }).eq("id", post.id);
    try {
      const result = await adapter({ id: post.id, platform: post.platform });
      if (result.ok) {
        published++;
        await sb.from("scheduled_posts").update({
          status: "published",
          published_at: new Date().toISOString(),
          platform_post_id: result.platformPostId ?? null,
          error: null,
        }).eq("id", post.id);
      } else {
        await sb.from("scheduled_posts").update({ status: "failed", error: result.error ?? "Publish failed" }).eq("id", post.id);
      }
    } catch (e) {
      await sb.from("scheduled_posts").update({ status: "failed", error: e instanceof Error ? e.message : "Publish failed" }).eq("id", post.id);
    }
  }
  return { due: (due ?? []).length, published, blocked };
}
