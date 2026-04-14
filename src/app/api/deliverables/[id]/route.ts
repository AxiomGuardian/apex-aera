/**
 * GET  /api/deliverables/[id]          — stream file (for preview / download)
 * GET  /api/deliverables/[id]?dl=1     — force content-disposition: attachment
 * DELETE /api/deliverables/[id]        — remove file + manifest entry
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "deliverables");
const MANIFEST   = path.join(UPLOAD_DIR, "_manifest.json");

type ManifestEntry = {
  id: string;
  name: string;
  filename: string;
  type: string;
  platform: string | null;
  size: number;
  sizeStr: string;
  mime: string;
  date: string;
};

async function readManifest(): Promise<ManifestEntry[]> {
  try {
    const raw = await readFile(MANIFEST, "utf-8");
    return JSON.parse(raw) as ManifestEntry[];
  } catch {
    return [];
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const forceDownload = req.nextUrl.searchParams.get("dl") === "1";

  const manifest = await readManifest();
  const entry = manifest.find((e) => e.id === id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filepath = path.join(UPLOAD_DIR, entry.filename);
  if (!existsSync(filepath)) return NextResponse.json({ error: "File missing" }, { status: 404 });

  const buffer = await readFile(filepath);

  const headers: Record<string, string> = {
    "Content-Type": entry.mime,
    "Content-Length": String(buffer.byteLength),
    "Cache-Control": "private, max-age=3600",
  };

  if (forceDownload) {
    headers["Content-Disposition"] = `attachment; filename="${entry.filename}"`;
  } else {
    headers["Content-Disposition"] = `inline; filename="${entry.filename}"`;
  }

  return new NextResponse(buffer, { headers });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const manifest = await readManifest();
  const entry = manifest.find((e) => e.id === id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filepath = path.join(UPLOAD_DIR, entry.filename);
  if (existsSync(filepath)) await unlink(filepath);

  const updated = manifest.filter((e) => e.id !== id);
  await writeFile(MANIFEST, JSON.stringify(updated, null, 2), "utf-8");

  return NextResponse.json({ ok: true });
}
