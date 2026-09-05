import type { SupabaseClient } from "@supabase/supabase-js";
import { emailEnabled, sendEmail, pastDueEmail, archivedEmail, purgeWarningEmail, inactivityEmail } from "@/lib/email";

/**
 * Brand lifecycle. Every transition is logged to lifecycle_events.
 *
 *  Manual:   archive -> restore, or delete permanently
 *  Billing:  Stripe webhook flips billing_status. past_due for GRACE_DAYS -> archive("unpaid")
 *            canceled -> archive("canceled") immediately
 *  Archive:  kept intact ARCHIVE_WINDOW_DAYS, warning email at WARN_BEFORE_PURGE_DAYS, then purge
 *  Activity: quiet INACTIVE_NOTICE_DAYS -> check-in email; quiet INACTIVE_ARCHIVE_DAYS -> archive("inactive")
 */

export const ARCHIVE_WINDOW_DAYS = 30;
export const WARN_BEFORE_PURGE_DAYS = 7;
export const GRACE_DAYS = 14;
export const INACTIVE_NOTICE_DAYS = 90;
export const INACTIVE_ARCHIVE_DAYS = 120;

const DAY = 24 * 3600 * 1000;

type BrandRow = {
  id: string; name: string; status: string; archived_at: string | null;
  billing_status: string; billing_past_due_since: string | null;
  last_activity_at: string | null; created_at: string;
  lifecycle_notices: Record<string, string> | null;
};

export async function logEvent(admin: SupabaseClient, brandId: string | null, brandName: string, event: string, reason: string | null, actor = "system") {
  await admin.from("lifecycle_events").insert({ brand_id: brandId, brand_name: brandName, event, reason, actor });
}

/* ---------- recipients ---------- */
async function teamEmails(admin: SupabaseClient, brandId: string): Promise<string[]> {
  const { data } = await admin.from("brand_members").select("profiles(email,role)").eq("brand_id", brandId);
  const rows = (data ?? []) as unknown as { profiles: { email: string; role: string } | null }[];
  return rows.map((r) => r.profiles).filter((p): p is { email: string; role: string } => !!p && p.role !== "agency_admin").map((p) => p.email);
}

async function notify(admin: SupabaseClient, brand: BrandRow, key: string, mail: { subject: string; html: string; text: string }) {
  const notices = brand.lifecycle_notices ?? {};
  if (notices[key]) return false; // already told them
  if (emailEnabled()) {
    const to = await teamEmails(admin, brand.id);
    for (const email of to) await sendEmail({ to: email, ...mail });
  }
  await admin.from("brands").update({ lifecycle_notices: { ...notices, [key]: new Date().toISOString() } }).eq("id", brand.id);
  await logEvent(admin, brand.id, brand.name, "notice_sent", key);
  return true;
}

/* ---------- transitions ---------- */
export async function archiveBrand(admin: SupabaseClient, brandId: string, reason: string, actor = "system") {
  const { data: brand, error } = await admin
    .from("brands")
    .update({ status: "archived", archived_at: new Date().toISOString(), archive_reason: reason, autopilot: false, lifecycle_notices: {} })
    .eq("id", brandId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(admin, brandId, brand.name, "archived", reason, actor);
  const kind = (["unpaid", "inactive", "canceled"].includes(reason) ? reason : "manual") as "unpaid" | "inactive" | "canceled" | "manual";
  await notify(admin, brand as BrandRow, "archived", archivedEmail({ brandName: brand.name, reason: kind, windowDays: ARCHIVE_WINDOW_DAYS }));
}

export async function restoreBrand(admin: SupabaseClient, brandId: string, actor = "system") {
  const { data: brand, error } = await admin
    .from("brands")
    .update({ status: "active", archived_at: null, archive_reason: null, lifecycle_notices: {}, last_activity_at: new Date().toISOString() })
    .eq("id", brandId)
    .select("name")
    .single();
  if (error) throw new Error(error.message);
  await logEvent(admin, brandId, brand.name, "restored", null, actor);
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

export async function purgeBrand(admin: SupabaseClient, brandId: string, actor = "system") {
  const { data: brand } = await admin.from("brands").select("name").eq("id", brandId).maybeSingle();
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

  // Log before the row (and its cascade) disappears; brand_id becomes null via ON DELETE CASCADE, name survives.
  await logEvent(admin, null, brand?.name ?? brandId, "purged", null, actor);
  const { error } = await admin.from("brands").delete().eq("id", brandId);
  if (error) throw new Error(error.message);
  return { removedMedia, removedThumbs, removedUsers };
}

/* ---------- billing signals (from the Stripe webhook) ---------- */
export async function markPastDue(admin: SupabaseClient, brandId: string) {
  const { data: brand } = await admin.from("brands").select("*").eq("id", brandId).maybeSingle();
  if (!brand || brand.billing_status === "past_due") return;
  await admin.from("brands").update({ billing_status: "past_due", billing_past_due_since: new Date().toISOString() }).eq("id", brandId);
  await logEvent(admin, brandId, brand.name, "billing_past_due", "payment failed", "stripe");
  await notify(admin, { ...brand, billing_status: "past_due" } as BrandRow, "past_due", pastDueEmail({ brandName: brand.name, graceDays: GRACE_DAYS }));
}

export async function markPaid(admin: SupabaseClient, brandId: string) {
  const { data: brand } = await admin.from("brands").select("id,name,billing_status,status,lifecycle_notices").eq("id", brandId).maybeSingle();
  if (!brand) return;
  const notices = { ...(brand.lifecycle_notices ?? {}) };
  delete notices.past_due;
  await admin.from("brands").update({ billing_status: "active", billing_past_due_since: null, lifecycle_notices: notices }).eq("id", brandId);
  await logEvent(admin, brandId, brand.name, "billing_paid", null, "stripe");
  // Paying again after an unpaid archive restores automatically
  if (brand.status === "archived") await restoreBrand(admin, brandId, "stripe");
}

export async function markCanceled(admin: SupabaseClient, brandId: string) {
  const { data: brand } = await admin.from("brands").select("id,name,status").eq("id", brandId).maybeSingle();
  if (!brand) return;
  await admin.from("brands").update({ billing_status: "canceled" }).eq("id", brandId);
  await logEvent(admin, brandId, brand.name, "billing_canceled", null, "stripe");
  if (brand.status !== "archived") await archiveBrand(admin, brandId, "canceled", "stripe");
}

/* ---------- the sweep (heartbeat) ---------- */
export async function runLifecycle(admin: SupabaseClient) {
  const now = Date.now();
  const out = { pastDueArchived: 0, purgeWarned: 0, purged: 0, inactiveNoticed: 0, inactiveArchived: 0 };

  const { data: rows } = await admin
    .from("brands")
    .select("id,name,status,archived_at,billing_status,billing_past_due_since,last_activity_at,created_at,lifecycle_notices");
  const brands = (rows ?? []) as BrandRow[];

  for (const b of brands) {
    try {
      if (b.status === "archived" && b.archived_at) {
        const age = now - new Date(b.archived_at).getTime();
        if (age >= ARCHIVE_WINDOW_DAYS * DAY) {
          await purgeBrand(admin, b.id);
          out.purged++;
          continue;
        }
        if (age >= (ARCHIVE_WINDOW_DAYS - WARN_BEFORE_PURGE_DAYS) * DAY) {
          const daysLeft = Math.max(1, Math.ceil((ARCHIVE_WINDOW_DAYS * DAY - age) / DAY));
          if (await notify(admin, b, "purge_warning", purgeWarningEmail({ brandName: b.name, daysLeft }))) out.purgeWarned++;
        }
        continue;
      }

      if (b.status !== "active") continue;

      // Billing grace period
      if (b.billing_status === "past_due" && b.billing_past_due_since) {
        if (now - new Date(b.billing_past_due_since).getTime() >= GRACE_DAYS * DAY) {
          await archiveBrand(admin, b.id, "unpaid");
          out.pastDueArchived++;
          continue;
        }
      }

      // Inactivity
      const lastActive = new Date(b.last_activity_at ?? b.created_at).getTime();
      const quiet = now - lastActive;
      if (quiet >= INACTIVE_ARCHIVE_DAYS * DAY) {
        await archiveBrand(admin, b.id, "inactive");
        out.inactiveArchived++;
      } else if (quiet >= INACTIVE_NOTICE_DAYS * DAY) {
        const quietDays = Math.floor(quiet / DAY);
        if (await notify(admin, b, "inactive_notice", inactivityEmail({ brandName: b.name, quietDays, archiveInDays: INACTIVE_ARCHIVE_DAYS - quietDays }))) out.inactiveNoticed++;
      }
    } catch (e) {
      console.error("[Lifecycle]", b.name, e);
    }
  }
  return out;
}

/** Kept for callers that only want the purge step. */
export async function purgeExpiredArchives(admin: SupabaseClient) {
  const r = await runLifecycle(admin);
  return r.purged;
}
