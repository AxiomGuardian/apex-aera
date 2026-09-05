import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBareClient } from "@supabase/supabase-js";
import { adminClient } from "@/lib/engines/core";
import { emailEnabled, sendEmail, inviteEmail } from "@/lib/email";

/**
 * Invite actions for agency admins.
 * POST { inviteId, action: "link" | "resend" }
 *   link   -> returns a fresh sign-in link you can copy and send yourself
 *   resend -> sends the invite email again (Resend if configured, else Supabase mailer)
 * Note: each new link replaces the previous one for that person.
 */

async function freshLink(email: string, redirectTo: string): Promise<string> {
  const admin = adminClient();
  // New person: invite (creates the user). Existing person: magic link.
  const first = await admin.auth.admin.generateLink({ type: "invite", email, options: { redirectTo } });
  if (!first.error && first.data?.properties?.action_link) return first.data.properties.action_link;
  const second = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo } });
  if (second.error || !second.data?.properties?.action_link) {
    throw new Error(second.error?.message ?? first.error?.message ?? "Could not generate link");
  }
  return second.data.properties.action_link;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("role").eq("id", u.user.id).single();
  if (me?.role !== "agency_admin") return NextResponse.json({ error: "Agency access required" }, { status: 403 });

  const { inviteId, action } = (await request.json()) as { inviteId?: string; action?: "link" | "resend" };
  if (!inviteId || !action) return NextResponse.json({ error: "inviteId and action required" }, { status: 400 });

  const { data: inv } = await supabase
    .from("invites")
    .select("id,email,status,brand_id,brands(name)")
    .eq("id", inviteId)
    .maybeSingle();
  if (!inv) return NextResponse.json({ error: "Invite not found" }, { status: 404 });

  const origin = new URL(request.url).origin;
  const redirectTo = origin + "/welcome";
  const brandName = ((inv as { brands?: { name?: string } | null }).brands?.name) ?? "your brand";

  try {
    if (action === "link") {
      const link = await freshLink(inv.email, redirectTo);
      return NextResponse.json({ ok: true, link });
    }

    // resend
    if (emailEnabled()) {
      const link = await freshLink(inv.email, redirectTo);
      const mail = inviteEmail({ brandName, link });
      const sent = await sendEmail({ to: inv.email, ...mail });
      if (!sent.ok) throw new Error(sent.error ?? "Email failed");
      return NextResponse.json({ ok: true, via: "resend" });
    }

    const bare = createBareClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { error } = await bare.auth.signInWithOtp({
      email: inv.email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, via: "supabase" });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}
