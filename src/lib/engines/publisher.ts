import type { SupabaseClient } from "@supabase/supabase-js";
import { publishInstagram, publishFacebook } from "./publishers/meta";

/**
 * Publishing engine (wireframe). Finds due posts and pushes them through
 * platform adapters. Until platform APIs are connected, posts stay queued
 * with an honest error — nothing is ever faked as "published".
 */

type Adapter = (sb: SupabaseClient, postId: string) => Promise<{ ok: boolean; platformPostId?: string; error?: string }>;

// Platform adapters. Meta (Instagram + Facebook) is live; more plug in here.
const ADAPTERS: Record<string, Adapter | undefined> = {
  instagram: publishInstagram,
  facebook: publishFacebook,
};

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
      .maybeSingle();

    const adapter = ADAPTERS[post.platform];
    if (!conn || conn.status !== "connected" || !adapter) {
      blocked++;
      const msg = conn?.status === "expired"
        ? "Platform connection expired. Reconnect this platform in the client workspace to publish."
        : "Awaiting platform connection. Connect this platform in the client workspace to publish.";
      await sb.from("scheduled_posts").update({ error: msg }).eq("id", post.id);
      continue;
    }

    await sb.from("scheduled_posts").update({ status: "publishing" }).eq("id", post.id);
    try {
      const result = await adapter(sb, post.id);
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
