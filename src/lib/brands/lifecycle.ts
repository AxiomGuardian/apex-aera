import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Brand lifecycle: archive -> (30 days) -> purge.
 * archive: flips status, stamps archived_at, keeps every row intact.
 * restore: flips back to active.
 * purge: storage + orphan client accounts + the brand row (cascades).
 */

export const ARCHIVE_WINDOW_DAYS = 30;

export async function archiveBrand(admin: SupabaseClient, brandId: string, reason: string) {
  const { error } = await admin
    .from("brands")
    .update({ status: "archived", archived_at: new Date().toISOString(), archive_reason: reason, autopilot: false })
    .eq("id", brandId);
  if (error) throw new Error(error.message);
}

export async function restoreBrand(admin: SupabaseClient, brandId: string) {
  const { error } = await admin
    .from("brands")
    .update({ status: "active", archived_at: null, archive_reason: null })
    .eq("id", brandId);
  if (error) throw new Error(error.message);
}

async function clearFolder(admin: SupabaseClient, bucket: string, prefix: string) {
  const { data: entries } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const e of entries ?? []) {
    if (e.id) files.push(prefix + "/" + e.name);
    else {
      const { data: inner } = await admin.storage.from(bucket).list(prefix + "/" + e.name, { limit: 1000 });
      for (const f of inner ?? []) if (f.id) files.push(prefix + "/" + e.name + "/" + f.name);
    }
  }
  if (files.length) await admin.storage.from(bucket).remove(files);
  return files.length;
}

export async function purgeBrand(admin: SupabaseClient, brandId: string) {
  const removedMedia = await clearFolder(admin, "media", brandId);
  const removedThumbs = await clearFolder(admin, "thumbnails", brandId);

  const { data: members } = await admin.from("brand_members").select("user_id").eq("brand_id", brandId);
  let removedUsers = 0;
  for (const m of members ?? []) {
    const { data: prof } = await admin.from("profiles").select("role").eq("id", m.user_id).maybeSingle();
    if (prof?.role !== "client") continue;
    const { count } = await admin.from("brand_members").select("brand_id", { count: "exact", head: true }).eq("user_id", m.user_id).neq("brand_id", brandId);
    if ((count ?? 0) > 0) continue;
    const { error } = await admin.auth.admin.deleteUser(m.user_id);
    if (!error) removedUsers++;
  }

  const { error } = await admin.from("brands").delete().eq("id", brandId);
  if (error) throw new Error(error.message);
  return { removedMedia, removedThumbs, removedUsers };
}

/** Purge everything past the archive window. Called by the heartbeat. */
export async function purgeExpiredArchives(admin: SupabaseClient) {
  const cutoff = new Date(Date.now() - ARCHIVE_WINDOW_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: expired } = await admin.from("brands").select("id,name").eq("status", "archived").lt("archived_at", cutoff);
  let purged = 0;
  for (const b of expired ?? []) {
    try { await purgeBrand(admin, b.id); purged++; }
    catch (e) { console.error("[Archive purge]", b.name, e); }
  }
  return purged;
}
