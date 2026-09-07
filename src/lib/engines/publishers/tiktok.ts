import type { SupabaseClient } from "@supabase/supabase-js";
import { publicMediaUrl } from "@/lib/media/link";

/**
 * TikTok publishing adapter (Content Posting API, Direct Post).
 * Video: FILE_UPLOAD in chunks streamed from storage (no domain verification needed).
 * Photo: PULL_FROM_URL via our signed media links (apexaera.com must be verified in the TikTok app).
 * Credentials in platform_connections.credentials: { kind: "tiktok", open_id, access_token, refresh_token, expires_at, refresh_expires_at }
 */

const TT = "https://open.tiktokapis.com/v2";
const CHUNK = 20 * 1024 * 1024; // 20 MB per chunk (TikTok allows 5-64 MB)

type PubResult = { ok: boolean; platformPostId?: string; error?: string };
type Creds = {
  kind?: string; open_id?: string; access_token?: string; refresh_token?: string;
  expires_at?: string; refresh_expires_at?: string;
};
type TTErr = { code?: string; message?: string; log_id?: string };

function siteOrigin(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? "https://www.apexaera.com";
}

/** Refresh the 24h access token when it is close to expiry. Persists the new pair. */
export async function ensureTikTokToken(sb: SupabaseClient, brandId: string, creds: Creds): Promise<Creds> {
  const expMs = creds.expires_at ? Date.parse(creds.expires_at) : 0;
  if (creds.access_token && expMs - Date.now() > 10 * 60 * 1000) return creds;
  if (!creds.refresh_token) throw new Error("TikTok session expired. Reconnect TikTok in the workspace.");
  const form = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
    client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
    grant_type: "refresh_token",
    refresh_token: creds.refresh_token,
  });
  const r = await fetch(TT + "/oauth/token/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  const j = (await r.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number; error?: string; error_description?: string };
  if (!j.access_token) throw new Error("TikTok refresh failed: " + (j.error_description ?? j.error ?? "unknown"));
  const now = Date.now();
  const next: Creds = {
    ...creds,
    access_token: j.access_token,
    refresh_token: j.refresh_token ?? creds.refresh_token,
    expires_at: new Date(now + (j.expires_in ?? 86400) * 1000).toISOString(),
    refresh_expires_at: new Date(now + (j.refresh_expires_in ?? 365 * 86400) * 1000).toISOString(),
  };
  await sb.from("platform_connections").update({ credentials: next, updated_at: new Date().toISOString() })
    .eq("brand_id", brandId).eq("platform", "tiktok");
  return next;
}

async function api<T>(path: string, token: string, body: unknown): Promise<T> {
  const r = await fetch(TT + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { data?: T; error?: TTErr };
  if (j.error && j.error.code && j.error.code !== "ok") throw new Error(`TikTok ${path}: ${j.error.message ?? j.error.code}`);
  return (j.data ?? {}) as T;
}

async function loadPost(sb: SupabaseClient, postId: string) {
  const { data: post, error } = await sb.from("scheduled_posts").select("id,brand_id,platform,caption_id,asset_id").eq("id", postId).single();
  if (error || !post) throw new Error("Post not found");
  const [{ data: caption }, { data: asset }, { data: conn }] = await Promise.all([
    post.caption_id ? sb.from("captions").select("text,hashtags").eq("id", post.caption_id).maybeSingle() : Promise.resolve({ data: null }),
    post.asset_id ? sb.from("content_assets").select("type,storage_path,title").eq("id", post.asset_id).maybeSingle() : Promise.resolve({ data: null }),
    sb.from("platform_connections").select("credentials").eq("brand_id", post.brand_id).eq("platform", "tiktok").eq("status", "connected").maybeSingle(),
  ]);
  let text = caption?.text ?? asset?.title ?? "";
  const tags = (caption?.hashtags ?? []) as string[];
  if (tags.length) text = text + " " + tags.join(" ");
  const isVideo = !!asset?.type && String(asset.type).startsWith("video");
  return { post, creds: (conn?.credentials ?? {}) as Creds, text: text.slice(0, 2200), storagePath: asset?.storage_path ?? null, isVideo };
}

/** Sandbox and unaudited apps may only post privately; pick the most open level TikTok allows. */
async function privacyLevel(token: string): Promise<string> {
  const info = await api<{ privacy_level_options?: string[] }>("/post/publish/creator_info/query/", token, {});
  const opts = info.privacy_level_options ?? [];
  for (const want of ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"]) if (opts.includes(want)) return want;
  return "SELF_ONLY";
}

async function waitForPublish(token: string, publishId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const s = await api<{ status?: string; fail_reason?: string; publicaly_available_post_id?: string[] }>("/post/publish/status/fetch/", token, { publish_id: publishId });
    if (s.status === "PUBLISH_COMPLETE") return s.publicaly_available_post_id?.[0] ?? publishId;
    if (s.status === "FAILED") throw new Error("TikTok rejected the post: " + (s.fail_reason ?? "unknown"));
    await new Promise((r) => setTimeout(r, 4000));
  }
  return publishId; // still processing on TikTok's side; treat as sent
}

export async function publishTikTok(sb: SupabaseClient, postId: string): Promise<PubResult> {
  try {
    const { post, creds, text, storagePath, isVideo } = await loadPost(sb, postId);
    if (!creds.open_id || !creds.access_token) return { ok: false, error: "TikTok not connected for this brand" };
    if (!storagePath) return { ok: false, error: "TikTok requires a video or image" };
    const fresh = await ensureTikTokToken(sb, post.brand_id, creds);
    const token = fresh.access_token!;
    const privacy = await privacyLevel(token);

    if (isVideo) {
      // Stream the file from storage to TikTok in chunks.
      const { data: signed } = await sb.storage.from("media").createSignedUrl(storagePath, 3600);
      if (!signed?.signedUrl) throw new Error("Could not read the video from storage");
      const head = await fetch(signed.signedUrl, { method: "HEAD" });
      const size = Number(head.headers.get("content-length") ?? 0);
      if (!size) throw new Error("Could not determine video size");
      const chunkSize = size <= CHUNK ? size : CHUNK;
      const total = Math.ceil(size / chunkSize);

      const init = await api<{ publish_id?: string; upload_url?: string }>("/post/publish/video/init/", token, {
        post_info: { title: text, privacy_level: privacy, disable_duet: false, disable_comment: false, disable_stitch: false, video_cover_timestamp_ms: 1000 },
        source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: chunkSize, total_chunk_count: total },
      });
      if (!init.publish_id || !init.upload_url) throw new Error("TikTok did not return an upload URL");

      for (let i = 0; i < total; i++) {
        const start = i * chunkSize;
        const end = Math.min(size, start + chunkSize) - 1;
        const part = await fetch(signed.signedUrl, { headers: { Range: `bytes=${start}-${end}` } });
        const buf = Buffer.from(await part.arrayBuffer());
        const put = await fetch(init.upload_url, {
          method: "PUT",
          headers: { "Content-Type": "video/mp4", "Content-Length": String(buf.length), "Content-Range": `bytes ${start}-${end}/${size}` },
          body: buf,
        });
        if (!put.ok && put.status !== 206) throw new Error("TikTok upload failed at chunk " + (i + 1) + " (" + put.status + ")");
      }
      const id = await waitForPublish(token, init.publish_id);
      return { ok: true, platformPostId: id };
    }

    // Photo post: TikTok pulls from our verified domain.
    const url = publicMediaUrl(siteOrigin(), storagePath, 6 * 3600);
    const init = await api<{ publish_id?: string }>("/post/publish/content/init/", token, {
      post_info: { title: text.slice(0, 90), description: text, privacy_level: privacy, disable_comment: false, auto_add_music: true },
      source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: [url] },
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
    });
    if (!init.publish_id) throw new Error("TikTok did not accept the photo post");
    const id = await waitForPublish(token, init.publish_id);
    return { ok: true, platformPostId: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "TikTok publish failed" };
  }
}
