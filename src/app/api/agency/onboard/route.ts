import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/engines/core";
import { emailEnabled, sendEmail, inviteEmail } from "@/lib/email";

/** Onboard a client: create their brand workspace, record the invite,
 *  and email them a sign-in link that lands on /welcome. Agency only. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("role").eq("id", userData.user.id).single();
  if (me?.role !== "agency_admin") {
    return NextResponse.json({ error: "Agency access required" }, { status: 403 });
  }

  const { brandName, email, tier } = (await request.json()) as { brandName?: string; email?: string; tier?: "client" | "enterprise" };
  if (!brandName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Brand name and email are required" }, { status: 400 });
  }
  const inviteRole = tier === "enterprise" ? "enterprise_admin" : "client";

  const slug =
    brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") +
    "-" + Math.random().toString(36).slice(2, 6);

  const { data: brand, error: brandErr } = await supabase
    .from("brands")
    .insert({ name: brandName.trim(), slug, status: "active" })
    .select("id,name")
    .single();
  if (brandErr) return NextResponse.json({ error: brandErr.message }, { status: 500 });

  const { error: invErr } = await supabase.from("invites").insert({
    email: email.trim().toLowerCase(),
    brand_id: brand.id,
    invited_by: userData.user.id,
    role: inviteRole,
  });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  const origin = new URL(request.url).origin;
  const cleanEmail = email.trim().toLowerCase();

  // Branded invite via Resend when configured: generate the invite link
  // ourselves and send it from our own domain.
  if (emailEnabled()) {
    const admin = adminClient();
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "invite",
      email: cleanEmail,
      options: { redirectTo: `${origin}/welcome` },
    });
    const actionLink = linkData?.properties?.action_link;
    // Apply the tier right away when the account was just created
    if (!linkErr && linkData?.user?.id) {
      await admin.from("profiles").update({ role: inviteRole }).eq("id", linkData.user.id).neq("role", "agency_admin");
    }
    if (!linkErr && actionLink) {
      const mail = inviteEmail({ brandName: brand.name, link: actionLink });
      const sent = await sendEmail({ to: cleanEmail, ...mail });
      if (sent.ok) return NextResponse.json({ ok: true, brand, via: "resend" });
      console.error("[Onboard] Resend failed, falling back to Supabase mailer:", sent.error);
    } else if (linkErr) {
      console.error("[Onboard] generateLink failed, falling back:", linkErr.message);
    }
  }

  // Fallback: Supabase's built-in magic link from a bare client so the agency session is untouched
  const bare = createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );
  const { error: otpErr } = await bare.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${origin}/welcome`, shouldCreateUser: true },
  });
  if (otpErr) {
    return NextResponse.json(
      { error: `Brand created, but the invite email failed: ${otpErr.message}`, brand },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, brand });
}
