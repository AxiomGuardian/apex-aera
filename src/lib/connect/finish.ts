import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";

/**
 * Shared plumbing for OAuth callbacks.
 * - Confirms the signed-in user can see this brand (RLS on brands decides).
 * - Hands back a privileged client for the write (platform_connections is
 *   agency-write-only under RLS, and clients connect their own accounts).
 * - Knows where to send the person afterwards based on their role.
 */
export async function connectContext(origin: string, brandId: string | undefined, param: string) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return { redirect: NextResponse.redirect(origin + "/login") };

  const { data: prof } = await supabase.from("profiles").select("role").eq("id", u.user.id).maybeSingle();
  const role = (prof?.role as string | null) ?? null;
  const clientSide = role === "client" || role === "enterprise_member";
  const landing = clientSide || !brandId ? "/brand" : "/clients/" + brandId;

  const back = (q: string, extra?: Record<string, string>) => {
    const url = new URL(origin + landing);
    url.searchParams.set(param, q);
    for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
    return NextResponse.redirect(url.toString());
  };

  if (!brandId) return { redirect: back("invalid"), back };

  const { data: brand } = await supabase.from("brands").select("id").eq("id", brandId).maybeSingle();
  if (!brand) return { redirect: back("no_access"), back };

  return { user: u.user, admin: adminClient(), back };
}
