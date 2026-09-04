import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Meta publishing adapter — Instagram Business + Facebook Pages.
 * Uses per-brand credentials stored in platform_connections.credentials:
 *   { page_id, page_token, page_name, ig_user_id?, ig_username? }
 * Media is served to Meta via short-lived signed URLs from Supabase storage.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

type PubResult = { ok: boolean; platformPostId?: string; error?: string };

type MetaCreds = {
  page_id?: string;
  page_token?: string;
  page_name?: string;
  ig_user_id?: string;
  ig_username?: string;
};

async function loadPost(sb: SupabaseClient, postId: string) {
  const { data: post, error } = await sb
    .from("scheduled_posts")
    .select("id,brand_id,platform,caption_id,asset_id")
    .eq("id", postId)
    .single();
  if (error || !post) throw new Error("Post not found");

  const [{ data: caption }, { data: asset }, { data: conn }] = await Promise.all([
    post.caption_id
      ? sb.from("captions").select("text,hashtags").eq("id", post.caption_id).maybeSingle()
      : Promise.resolve({ data: null }),
    post.asset_id
      ? sb.from("content_assets").select("type,storage_path,title").eq("id", post.asset_id).maybeSingle()
      : Promise.resolve({ data: null }),
    sb.from("platform_connections")
      .select("credentials,account_name")
      .eq("brand_id", post.brand_id)
      .eq("platform", post.platform)
      .eq("status", "connected")
      .maybeSingle(),
  ]);

  const creds = (conn?.credentials ?? {}) as MetaCreds;
  let captionText = caption?.text ?? asset?.title ?? "";
  const tags = (caption?.hashtags ?? []) as string[];
  if (tags.length) captionText = captionText + "\n\n" + tags.join(" ");

  let mediaUrl: string | null = null;
  let isVideo = false;
  if (asset?.storage_path) {
    // Meta fetches media asynchronously; give the link plenty of life.
    const { data: signed } = await sb.storage.from("media").createSignedUrl(asset.storage_path, 21600);
    mediaUrl = signed?.signedUrl ?? null;
    isVideo = asset.type === "video_short" || asset.type === "video_long" || String(asset.type).startsWith("video");
  }

  return { post, creds, captionText, mediaUrl, isVideo };
}

async function graph(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params);
  const res = await fetch(GRAPH + path, { method: "POST", body });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json?.error as { message?: string } | undefined;
    throw new Error(err?.message ?? "Meta API error " + res.status);
  }
  return json;
}

async function waitForContainer(creationId: string, token: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(GRAPH + "/" + creationId + "?fields=status_code&access_token=" + encodeURIComponent(token));
    const json = (await res.json()) as { status_code?: string };
    if (json.status_code === "FINISHED") return;
    if (json.status_code === "ERROR") throw new Error("Instagram could not process the media");
    await new Promise((r) => setTimeout(r, 6000));
  }
  throw new Error("Instagram media processing timed out");
}

export async function publishInstagram(sb: SupabaseClient, postId: string): Promise<PubResult> {
  try {
    const { creds, captionText, mediaUrl, isVideo } = await loadPost(sb, postId);
    if (!creds.ig_user_id || !creds.page_token) {
      return { ok: false, error: "Instagram not connected for this brand" };
    }
    if (!mediaUrl) return { ok: false, error: "Instagram requires an image or video" };

    const params: Record<string, string> = {
      access_token: creds.page_token,
      caption: captionText.slice(0, 2200),
    };
    if (isVideo) {
      params.media_type = "REELS";
      params.video_url = mediaUrl;
    } else {
      params.image_url = mediaUrl;
    }

    const container = await graph("/" + creds.ig_user_id + "/media", params);
    const creationId = String(container.id);
    if (isVideo) await waitForContainer(creationId, creds.page_token);

    const published = await graph("/" + creds.ig_user_id + "/media_publish", {
      access_token: creds.page_token,
      creation_id: creationId,
    });
    return { ok: true, platformPostId: String(published.id) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Instagram publish failed" };
  }
}

export async function publishFacebook(sb: SupabaseClient, postId: string): Promise<PubResult> {
  try {
    const { creds, captionText, mediaUrl, isVideo } = await loadPost(sb, postId);
    if (!creds.page_id || !creds.page_token) {
      return { ok: false, error: "Facebook Page not connected for this brand" };
    }

    let result: Record<string, unknown>;
    if (mediaUrl && isVideo) {
      result = await graph("/" + creds.page_id + "/videos", {
        access_token: creds.page_token,
        file_url: mediaUrl,
        description: captionText,
      });
    } else if (mediaUrl) {
      result = await graph("/" + creds.page_id + "/photos", {
        access_token: creds.page_token,
        url: mediaUrl,
        message: captionText,
      });
    } else {
      if (!captionText.trim()) return { ok: false, error: "Nothing to post" };
      result = await graph("/" + creds.page_id + "/feed", {
        access_token: creds.page_token,
        message: captionText,
      });
    }
    const id = (result.post_id ?? result.id) as string | undefined;
    return { ok: true, platformPostId: id ? String(id) : undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Facebook publish failed" };
  }
}
