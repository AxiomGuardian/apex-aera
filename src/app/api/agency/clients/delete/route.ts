import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";

/**
 * Delete a client workspace. Agency admins only.
 * POST { brandId }
 * Removes: media + thumbnails in storage, client-only user accounts attached
 * to this brand (users who belong to no other brand), then the brand row.
 * Database cascades clear content, captions, posts, invites, connections,
 * reports, briefs, funnels, and AERA chats.
 */

async function clearFolder(sb: ReturnType<typeof adminClient>, bucket: string, prefix: string) {
  const { data: entries } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
  const files: string[] = [];
  for (const e of entries ?? []) {
    if (e.id) {
      files.push(prefix + "/" + e.name);
    } else {
      // folder: one level deeper (assets live at {brand}/{asset}/file)
      const { data: inner } = await sb.storage.from(bucket).list(prefix + "/" + e.name, { limit: 1000 });
      for (const f of inner ?? []) if (f.id) files.push(prefix + "/" + e.name + "/" + f.name);
    }
  }
  if (files.length) await sb.storage.from(bucket).remove(files);
  return files.length;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
  if (me?.role !== "agency_admin") return NextResponse.json({ error: "Agency access required" }, { status: 403 });

  const { brandId } = (await request.json()) as { brandId?: string };
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });

  const admin = adminClient();
  const { data: brand } = await admin.from("brands").select("id,name").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  try {
    // 1) Storage
    const removedMedia = await clearFolder(admin, "media", brandId);
    const removedThumbs = await clearFolder(admin, "thumbnails", brandId);

    // 2) Client-only accounts that belong to nothing else
    const { data: members } = await admin.from("brand_members").select("user_id").eq("brand_id", brandId);
    let removedUsers = 0;
    for (const m of members ?? []) {
      const { data: prof } = await admin.from("profiles").select("role").eq("id", m.user_id).maybeSingle();
      if (prof?.role !== "client") continue;
      const { count } = await admin
        .from("brand_members")
        .select("brand_id", { count: "exact", head: true })
        .eq("user_id", m.user_id)
        .neq("brand_id", brandId);
      if ((count ?? 0) > 0) continue;
      const { error } = await admin.auth.admin.deleteUser(m.user_id);
      if (!error) removedUsers++;
    }

    // 3) The brand itself (cascades everything else)
    const { error: delErr } = await admin.from("brands").delete().eq("id", brandId);
    if (delErr) throw new Error(delErr.message);

    return NextResponse.json({ ok: true, name: brand.name, removedMedia, removedThumbs, removedUsers });
  } catch (e) {
    console.error("[Delete client]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Delete failed" }, { status: 500 });
  }
}
