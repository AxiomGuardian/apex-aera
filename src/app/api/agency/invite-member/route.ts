import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";
import { emailEnabled, sendEmail, inviteEmail } from "@/lib/email";

/**
 * Invite a person into an EXISTING brand workspace.
 * POST { brandId, email }
 * Agency admins: any brand. Enterprise admins: brands inside their org.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
  if (me?.role !== "agency_admin" && me?.role !== "enterprise_admin") {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { brandId, email } = (await request.json()) as { brandId?: string; email?: string };
  if (!brandId || !email?.trim()) return NextResponse.json({ error: "brandId and email required" }, { status: 400 });
  const cleanEmail = email.trim().toLowerCase();

  // RLS: enterprise admins can only read their own org's brands
  const { data: brand } = await supabase.from("brands").select("id,name,enterprise_id").eq("id", brandId).maybeSingle();
  if (!brand) return NextResponse.json({ error: "Brand not found" }, { status: 404 });

  const role = brand.enterprise_id ? "enterprise_member" : "client";
  const admin = adminClient();

  const { error: invErr } = await admin.from("invites").insert({
    email: cleanEmail,
    brand_id: brand.id,
    enterprise_id: brand.enterprise_id,
    invited_by: u.user.id,
    role,
  });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const redirectTo = origin + "/welcome";

  // Create (or find) the account and get a link
  let link: string | null = null;
  const first = await admin.auth.admin.generateLink({ type: "invite", email: cleanEmail, options: { redirectTo } });
  if (!first.error && first.data?.properties?.action_link) {
    link = first.data.properties.action_link;
    if (first.data.user?.id) {
      await admin.from("profiles").update({ role }).eq("id", first.data.user.id).neq("role", "agency_admin");
    }
  } else {
    // Existing person: attach them to the brand right away and send a magic link
    const { data: prof } = await admin.from("profiles").select("id").ilike("email", cleanEmail).maybeSingle();
    if (prof?.id) {
      await admin.from("brand_members").upsert({ brand_id: brand.id, user_id: prof.id }, { onConflict: "brand_id,user_id" });
      if (brand.enterprise_id) {
        await admin.from("enterprise_members").upsert({ enterprise_id: brand.enterprise_id, user_id: prof.id, is_admin: false }, { onConflict: "enterprise_id,user_id" });
      }
      await admin.from("invites").update({ status: "claimed", claimed_at: new Date().toISOString(), accepted_at: new Date().toISOString() })
        .eq("brand_id", brand.id).ilike("email", cleanEmail).eq("status", "pending");
    }
    const second = await admin.auth.admin.generateLink({ type: "magiclink", email: cleanEmail, options: { redirectTo } });
    link = second.data?.properties?.action_link ?? null;
  }

  if (emailEnabled() && link) {
    const mail = inviteEmail({ brandName: brand.name, link });
    const sent = await sendEmail({ to: cleanEmail, ...mail });
    if (!sent.ok) return NextResponse.json({ ok: true, warning: "Invite saved but email failed: " + sent.error, link });
  }

  return NextResponse.json({ ok: true, link: emailEnabled() ? undefined : link });
}
