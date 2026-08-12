import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createBareClient } from "@supabase/supabase-js";

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

  const { brandName, email } = (await request.json()) as { brandName?: string; email?: string };
  if (!brandName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Brand name and email are required" }, { status: 400 });
  }

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
  });
  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  // Send the sign-in link from a bare client so the agency session is untouched
  const origin = new URL(request.url).origin;
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
