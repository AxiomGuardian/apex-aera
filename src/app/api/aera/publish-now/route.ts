import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/engines/core";
import { publishOne } from "@/lib/engines/publisher";

export const maxDuration = 60;

/** POST { postId } — publish a queued post immediately. Caller must have access to the post's brand. */
export async function POST(request: Request) {
  const { postId } = (await request.json()) as { postId?: string };
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  // RLS: the user can only see posts on brands they have access to.
  const { data: post } = await supabase.from("scheduled_posts").select("id").eq("id", postId).maybeSingle();
  if (!post) return NextResponse.json({ error: "No access to this post" }, { status: 403 });

  const result = await publishOne(adminClient(), postId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
