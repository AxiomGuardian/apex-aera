// ─── Integration Disconnect ───────────────────────────────────────────────────
// POST /api/integrations/connect/disconnect
// Body: { platform: "meta" | "google" | "linkedin" }
// Clears the encrypted cookie for the given platform.

import { NextResponse } from "next/server";
import { clearToken } from "@/lib/integrations/tokenStore";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const { platform } = await request.json() as { platform?: string };

    if (platform !== "meta" && platform !== "google" && platform !== "linkedin") {
      return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    }

    await clearToken(platform);
    return NextResponse.json({ success: true, disconnected: platform });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
