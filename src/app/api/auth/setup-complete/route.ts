import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";

/** Called once the person finishes the welcome page. Marks their invites as accepted. */
export async function POST() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user?.email) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const admin = adminClient();
  await admin
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .ilike("email", u.user.email)
    .is("accepted_at", null);
  return NextResponse.json({ ok: true });
}
