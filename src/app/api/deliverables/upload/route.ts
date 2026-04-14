/**
 * POST /api/deliverables/upload
 *
 * Accepts a multipart/form-data upload with fields:
 *   file    — the binary file
 *   name    — display name (optional, defaults to filename)
 *   type    — PDF | Design | Video | Copy | Other
 *   platform — YouTube | Instagram | LinkedIn | Gmail | null
 *
 * Writes file to /uploads/deliverables/<uuid>.<ext>
 * Updates /uploads/deliverables/_manifest.json
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "deliverables");
const MANIFEST   = path.join(UPLOAD_DIR, "_manifest.json");

type ManifestEntry = {
  id:       string;
  name:     string;
  filename: string;
  type:     string;
  platform: string | null;
  size:     number;
  sizeStr:  string;
  mime:     string;
  date:     string;
};

async function readManifest(): Promise<ManifestEntry[]> {
  try {
    const raw = await readFile(MANIFEST, "utf-8");
    return JSON.parse(raw) as ManifestEntry[];
  } catch {
    return [];
  }
}

async function writeManifest(entries: ManifestEntry[]) {
  await writeFile(MANIFEST, JSON.stringify(entries, null, 2), "utf-8");
}

function humanSize(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000)     return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000)         return `${(bytes / 1_000).toFixed(0)} KB`;
  return `${bytes} B`;
}

export async function POST(req: NextRequest) {
  try {
    if (!existsSync(UPLOAD_DIR)) await mkdir(UPLOAD_DIR, { recursive: true });

    const form     = await req.formData();
    const file     = form.get("file") as File | null;
    const name     = (form.get("name") as string | null) || null;
    const type     = (form.get("type") as string | null)  || "Other";
    const platform = (form.get("platform") as string | null) || null;

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const ext      = path.extname(file.name) || "";
    const id       = randomUUID();
    const filename = `${id}${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    const entry: ManifestEntry = {
      id,
      name:     name || file.name.replace(/\.[^/.]+$/, ""),
      filename,
      type,
      platform: platform && platform !== "null" ? platform : null,
      size:     file.size,
      sizeStr:  humanSize(file.size),
      mime:     file.type || "application/octet-stream",
      date:     new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };

    const manifest = await readManifest();
    manifest.unshift(entry);
    await writeManifest(manifest);

    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    console.error("[deliverables/upload]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

export async function GET() {
  const manifest = await readManifest();
  return NextResponse.json(manifest);
}
