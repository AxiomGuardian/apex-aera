import { NextResponse } from "next/server";
import { verifyMediaLink } from "@/lib/media/link";
import { adminClient } from "@/lib/engines/core";

/** Streams a media file from storage behind a signed, expiring token. */
export const maxDuration = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const v = verifyMediaLink(token);
  if (!v) return new NextResponse("Link expired or invalid", { status: 403 });

  const { data, error } = await adminClient().storage.from("media").createSignedUrl(v.path, 600);
  if (error || !data?.signedUrl) return new NextResponse("Not found", { status: 404 });

  const upstream = await fetch(data.signedUrl, { headers: { Range: _req.headers.get("range") ?? "" } });
  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges", "last-modified", "etag"]) {
    const val = upstream.headers.get(h);
    if (val) headers.set(h, val);
  }
  headers.set("cache-control", "private, max-age=600");
  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export async function HEAD(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const res = await GET(req, ctx);
  return new NextResponse(null, { status: res.status, headers: res.headers });
}
