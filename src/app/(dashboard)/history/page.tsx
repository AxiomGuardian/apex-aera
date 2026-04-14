"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/ui/BrandIcon";
import {
  Download, Eye, FileText, Video, Image, Mail,
  Upload, X, Trash2, Plus, AlertCircle, CheckCircle2,
} from "lucide-react";
import { PagePad } from "@/components/layout/PagePad";

/* ─── Types ─────────────────────────────────────────────────────── */
type DeliverableEntry = {
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

/* ─── Placeholder seed (shown when no uploads yet) ──────────────── */
const SEED: DeliverableEntry[] = [
  { id: "seed-1", name: "Q1 Brand Report — Full PDF",      filename: "",  type: "PDF",    platform: null,        size: 0, sizeStr: "4.2 MB",  mime: "application/pdf",  date: "Mar 15, 2026" },
  { id: "seed-2", name: "Instagram Carousel Pack × 8",     filename: "",  type: "Design", platform: "Instagram", size: 0, sizeStr: "18.7 MB", mime: "image/png",         date: "Mar 12, 2026" },
  { id: "seed-3", name: "YouTube Brand Video — Final",      filename: "",  type: "Video",  platform: "YouTube",   size: 0, sizeStr: "412 MB",  mime: "video/mp4",         date: "Mar 8, 2026"  },
  { id: "seed-4", name: "Email Nurture Sequence — Phase 1", filename: "",  type: "Copy",   platform: "Gmail",     size: 0, sizeStr: "84 KB",   mime: "text/plain",        date: "Feb 28, 2026" },
  { id: "seed-5", name: "Voice & Tone Guide 2026",          filename: "",  type: "PDF",    platform: null,        size: 0, sizeStr: "2.1 MB",  mime: "application/pdf",   date: "Feb 14, 2026" },
  { id: "seed-6", name: "LinkedIn Thought Leadership × 12", filename: "",  type: "Copy",   platform: "LinkedIn",  size: 0, sizeStr: "156 KB",  mime: "text/plain",        date: "Feb 5, 2026"  },
];

/* ─── Style map ─────────────────────────────────────────────────── */
const typeStyle: Record<string, { color: string; bg: string; border: string }> = {
  PDF:    { color: "var(--text-4)",  bg: "var(--surface-2)",      border: "var(--border)"          },
  Design: { color: "var(--cyan)",    bg: "rgba(45,212,255,0.07)", border: "rgba(45,212,255,0.16)"  },
  Video:  { color: "var(--silver)",  bg: "var(--surface-3)",      border: "var(--border-mid)"      },
  Copy:   { color: "var(--text-4)",  bg: "var(--surface-2)",      border: "var(--border)"          },
  Other:  { color: "var(--text-4)",  bg: "var(--surface-2)",      border: "var(--border)"          },
};

const typeIcons: Record<string, React.ComponentType<{ style?: React.CSSProperties; strokeWidth?: number }>> = {
  PDF:    FileText,
  Design: Image,
  Video:  Video,
  Copy:   Mail,
  Other:  FileText,
};

/* ─── Helpers ───────────────────────────────────────────────────── */
function mimeToType(mime: string): string {
  if (mime.includes("pdf"))   return "PDF";
  if (mime.startsWith("video")) return "Video";
  if (mime.startsWith("image")) return "Design";
  if (mime.includes("text") || mime.includes("doc")) return "Copy";
  return "Other";
}

function isPreviewable(mime: string) {
  return mime.startsWith("image/") || mime === "application/pdf" || mime.startsWith("text/");
}

/* ─── Small sub-components ─────────────────────────────────────── */
function StatCard({ label, value }: { label: string; value: string }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "22px 22px 20px", borderRadius: 16,
        background: hov ? "var(--hover-fill-cyan)" : "var(--surface)",
        border: `1px solid ${hov ? "var(--border-mid)" : "var(--border)"}`,
        boxShadow: hov ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        transition: "background 0.22s, border-color 0.22s, box-shadow 0.22s",
        cursor: "default", position: "relative" as const, overflow: "hidden",
      }}
    >
      <div style={{ fontSize: "clamp(26px,4vw,34px)", fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--text)", fontFeatureSettings: '"tnum"' }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-6)", marginTop: 7, letterSpacing: "0.01em" }}>{label}</div>
      <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 1, background: "linear-gradient(90deg,transparent,rgba(45,212,255,0.28),transparent)", opacity: hov ? 1 : 0, transition: "opacity 0.22s" }} />
    </div>
  );
}

function ActionBtn({
  icon, cyanHover, onClick, title,
}: {
  icon: React.ReactNode;
  cyanHover?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32, borderRadius: 8,
        background: hov ? (cyanHover ? "rgba(45,212,255,0.09)" : "var(--surface-3)") : "var(--surface-2)",
        border: `1px solid ${hov ? (cyanHover ? "rgba(45,212,255,0.22)" : "var(--border-mid)") : "var(--border)"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {icon}
    </button>
  );
}

/* ─── View modal ────────────────────────────────────────────────── */
function ViewModal({ entry, onClose }: { entry: DeliverableEntry; onClose: () => void }) {
  const isSeed = entry.id.startsWith("seed-");
  const url    = isSeed ? null : `/api/deliverables/${entry.id}`;
  const canPreview = !isSeed && isPreviewable(entry.mime);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(860px, 100%)", maxHeight: "88vh",
          borderRadius: 20,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.55)",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 22px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.015em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</p>
            <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 3 }}>{entry.date} · {entry.sizeStr} · {entry.mime}</p>
          </div>
          {!isSeed && url && (
            <a
              href={`${url}?dl=1`}
              download
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: "rgba(45,212,255,0.07)", border: "1px solid rgba(45,212,255,0.18)", color: "var(--cyan)", fontSize: 12, fontWeight: 600, letterSpacing: "0.01em", textDecoration: "none", flexShrink: 0 }}
            >
              <Download style={{ width: 12, height: 12 }} strokeWidth={1.7} />
              Download
            </a>
          )}
          <button
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <X style={{ width: 14, height: 14, color: "var(--text-5)" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
          {isSeed ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 12 }}>
              <AlertCircle style={{ width: 28, height: 28, color: "var(--text-6)" }} strokeWidth={1.3} />
              <p style={{ fontSize: 13, color: "var(--text-5)" }}>This is a placeholder entry. Upload the actual file to enable preview.</p>
            </div>
          ) : canPreview ? (
            entry.mime.startsWith("image/") ? (
              <img src={url!} alt={entry.name} style={{ width: "100%", height: "auto", display: "block" }} />
            ) : entry.mime === "application/pdf" ? (
              <iframe src={url!} style={{ width: "100%", height: "70vh", border: "none" }} title={entry.name} />
            ) : (
              <iframe src={url!} style={{ width: "100%", height: "70vh", border: "none", background: "var(--bg)" }} title={entry.name} />
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 320, gap: 12 }}>
              <FileText style={{ width: 28, height: 28, color: "var(--text-6)" }} strokeWidth={1.3} />
              <p style={{ fontSize: 13, color: "var(--text-5)" }}>Preview not available for this file type.</p>
              {url && (
                <a href={`${url}?dl=1`} download style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, background: "rgba(45,212,255,0.07)", border: "1px solid rgba(45,212,255,0.18)", color: "var(--cyan)", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                  <Download style={{ width: 12, height: 12 }} strokeWidth={1.7} /> Download instead
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Upload modal ──────────────────────────────────────────────── */
const TYPE_OPTIONS  = ["PDF", "Design", "Video", "Copy", "Other"];
const PLATFORM_OPTIONS = ["None", "YouTube", "Instagram", "LinkedIn", "Gmail", "Meta", "TikTok", "X"];

function UploadModal({ onClose, onUploaded }: { onClose: () => void; onUploaded: (entry: DeliverableEntry) => void }) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const [file,     setFile]     = useState<File | null>(null);
  const [name,     setName]     = useState("");
  const [type,     setType]     = useState("PDF");
  const [platform, setPlatform] = useState("None");
  const [uploading, setUploading] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setName(f.name.replace(/\.[^/.]+$/, ""));
    const guessed = mimeToType(f.type);
    setType(guessed);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file",     file);
      form.append("name",     name || file.name);
      form.append("type",     type);
      form.append("platform", platform === "None" ? "null" : platform);
      const res = await fetch("/api/deliverables/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json() as { ok: boolean; entry: DeliverableEntry };
      onUploaded(data.entry);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(520px,100%)", borderRadius: 20, background: "var(--surface)", border: "1px solid var(--border)", boxShadow: "0 32px 80px rgba(0,0,0,0.55)", overflow: "hidden" }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border)" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.015em" }}>Upload Deliverable</p>
            <p style={{ fontSize: 11, color: "var(--text-6)", marginTop: 2 }}>Add a file to the client deliverables vault</p>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X style={{ width: 14, height: 14, color: "var(--text-5)" }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{
              borderRadius: 14, border: `2px dashed ${file ? "rgba(45,212,255,0.35)" : "var(--border)"}`,
              background: file ? "rgba(45,212,255,0.03)" : "var(--surface-2)",
              padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
              cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
            }}
          >
            {file ? (
              <>
                <CheckCircle2 style={{ width: 22, height: 22, color: "var(--cyan)" }} strokeWidth={1.5} />
                <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text-2)", textAlign: "center" }}>{file.name}</p>
                <p style={{ fontSize: 11, color: "var(--text-6)" }}>{(file.size / 1024).toFixed(0)} KB · Click to change</p>
              </>
            ) : (
              <>
                <Upload style={{ width: 22, height: 22, color: "var(--text-6)" }} strokeWidth={1.4} />
                <p style={{ fontSize: 13, color: "var(--text-4)", textAlign: "center" }}>Drop file here or <span style={{ color: "var(--cyan)" }}>browse</span></p>
                <p style={{ fontSize: 11, color: "var(--text-6)" }}>PDF, images, video, documents — any format</p>
              </>
            )}
            <input ref={fileRef} type="file" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Display Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q2 Brand Report"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          {/* Type + Platform */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, outline: "none" }}
              >
                {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-5)", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 }}>Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, outline: "none" }}
              >
                {PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 9, background: "rgba(251,113,133,0.07)", border: "1px solid rgba(251,113,133,0.18)" }}>
              <AlertCircle style={{ width: 14, height: 14, color: "#fb7185", flexShrink: 0 }} strokeWidth={1.5} />
              <p style={{ fontSize: 12, color: "#fb7185" }}>{error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 4 }}>
            <button
              onClick={onClose}
              style={{ padding: "9px 18px", borderRadius: 9, background: "transparent", border: "1px solid var(--border)", color: "var(--text-4)", fontSize: 13, cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!file || uploading}
              style={{
                padding: "9px 20px", borderRadius: 9,
                background: file && !uploading ? "rgba(45,212,255,0.10)" : "var(--surface-2)",
                border: `1px solid ${file && !uploading ? "rgba(45,212,255,0.25)" : "var(--border)"}`,
                color: file && !uploading ? "var(--cyan)" : "var(--text-6)",
                fontSize: 13, fontWeight: 600, cursor: file && !uploading ? "pointer" : "default",
                transition: "all 0.15s", display: "flex", alignItems: "center", gap: 7,
              }}
            >
              {uploading ? (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: "50%", border: "1.5px solid rgba(45,212,255,0.25)", borderTopColor: "var(--cyan)", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                  Uploading…
                </>
              ) : (
                <><Upload style={{ width: 12, height: 12 }} strokeWidth={1.7} /> Upload</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Deliverable row ───────────────────────────────────────────── */
function DeliverableRow({
  d, index, isLast,
  onView, onDownload, onDelete,
}: {
  d: DeliverableEntry;
  index: number;
  isLast: boolean;
  onView: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  const isSeed = d.id.startsWith("seed-");
  const ts  = typeStyle[d.type]  ?? typeStyle.Other;
  const IconComp = typeIcons[d.type] ?? typeIcons.Other;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="relative flex items-center gap-4 sm:gap-5 px-5 sm:px-7 py-5 sm:py-[22px] opacity-0 animate-fade-in-up"
      style={{
        animationDelay: `${0.06 + index * 0.06}s`, animationFillMode: "forwards",
        background: hov ? "var(--hover-fill-cyan)" : "transparent",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
        transition: "background 0.22s", cursor: "default",
      }}
    >
      {/* Left accent */}
      <div style={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 2, borderRadius: 2, background: "linear-gradient(180deg,var(--cyan),rgba(45,212,255,0.25))", opacity: hov ? 0.6 : 0, transition: "opacity 0.22s" }} />

      {/* File icon */}
      <div style={{ width: 40, height: 40, borderRadius: 11, background: hov ? "rgba(45,212,255,0.05)" : "var(--surface-2)", border: `1px solid ${hov ? "rgba(45,212,255,0.12)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.22s, border-color 0.22s" }}>
        <IconComp style={{ width: 15, height: 15, color: hov ? "var(--text-4)" : "var(--text-6)" }} strokeWidth={1.5} />
      </div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 400, letterSpacing: "-0.012em", color: hov ? "var(--text-2)" : "var(--text-3)", transition: "color 0.2s", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
          {d.name}
          {isSeed && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--text-6)", fontStyle: "italic" }}>(placeholder)</span>}
        </p>
        <p style={{ fontSize: 11, marginTop: 4, color: "var(--text-6)", letterSpacing: "0.01em" }}>
          {d.date}&nbsp;&nbsp;·&nbsp;&nbsp;{d.sizeStr}
        </p>
      </div>

      {/* Type badge */}
      <span className="hidden sm:inline-flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.04em", padding: "4px 10px", borderRadius: 20, color: ts.color, background: ts.bg, border: `1px solid ${ts.border}`, flexShrink: 0, transition: "opacity 0.2s" }}>
        {d.platform && <BrandIcon name={d.platform} size={10} color={hov ? undefined : ts.color} />}
        {d.platform ?? d.type}
      </span>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0, opacity: hov ? 1 : 0, transform: hov ? "translateX(0)" : "translateX(10px)", transition: "opacity 0.2s, transform 0.2s" }}>
        <ActionBtn
          title="Preview"
          icon={<Eye style={{ width: 12, height: 12, color: "var(--text-4)" }} strokeWidth={1.6} />}
          onClick={(e) => { e.stopPropagation(); onView(); }}
        />
        <ActionBtn
          title="Download"
          cyanHover
          icon={<Download style={{ width: 12, height: 12, color: "var(--text-4)" }} strokeWidth={1.7} />}
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
        />
        {!isSeed && (
          <ActionBtn
            title="Delete"
            icon={<Trash2 style={{ width: 12, height: 12, color: "var(--text-6)" }} strokeWidth={1.5} />}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          />
        )}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────── */
export default function HistoryPage() {
  const [entries,    setEntries]    = useState<DeliverableEntry[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [viewing,    setViewing]    = useState<DeliverableEntry | null>(null);
  const [uploading,  setUploading]  = useState(false);

  /* Merge uploaded entries on top of seed data */
  const allEntries = useCallback(() => {
    const uploadedIds = new Set(entries.map((e) => e.id));
    const seed = SEED.filter((s) => !uploadedIds.has(s.id));
    return [...entries, ...seed];
  }, [entries]);

  /* Fetch uploaded manifest on mount */
  useEffect(() => {
    fetch("/api/deliverables/upload")
      .then((r) => r.json() as Promise<DeliverableEntry[]>)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const handleUploaded = (entry: DeliverableEntry) => {
    setEntries((prev) => [entry, ...prev]);
  };

  const handleDownload = (d: DeliverableEntry) => {
    if (d.id.startsWith("seed-")) {
      alert("This is a placeholder entry. Upload the actual file to enable download.");
      return;
    }
    const a = document.createElement("a");
    a.href = `/api/deliverables/${d.id}?dl=1`;
    a.download = d.filename;
    a.click();
  };

  const handleDelete = async (d: DeliverableEntry) => {
    if (!confirm(`Delete "${d.name}"? This cannot be undone.`)) return;
    await fetch(`/api/deliverables/${d.id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== d.id));
  };

  const handleDownloadAll = () => {
    const real = allEntries().filter((e) => !e.id.startsWith("seed-"));
    if (real.length === 0) {
      alert("No uploaded files yet. Upload files first to use Download All.");
      return;
    }
    real.forEach((d, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = `/api/deliverables/${d.id}?dl=1`;
        a.download = d.filename;
        a.click();
      }, i * 400);
    });
  };

  const displayed = allEntries();
  const realCount = entries.length;
  const totalSize = entries.reduce((acc, e) => acc + e.size, 0);

  const humanTotal = totalSize >= 1_000_000_000
    ? `${(totalSize / 1_000_000_000).toFixed(1)} GB`
    : totalSize >= 1_000_000
    ? `${(totalSize / 1_000_000).toFixed(1)} MB`
    : totalSize >= 1_000
    ? `${(totalSize / 1_000).toFixed(0)} KB`
    : realCount === 0 ? "—" : `${totalSize} B`;

  const thisMonth = entries.filter((e) => {
    const d = new Date(e.date);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <PagePad>
      {/* Modals */}
      {viewing  && <ViewModal   entry={viewing}  onClose={() => setViewing(null)} />}
      {uploading && (
        <UploadModal
          onClose={() => setUploading(false)}
          onUploaded={handleUploaded}
        />
      )}

      <div className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>

        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <p className="label-eyebrow mb-2.5">History</p>
            <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 700, letterSpacing: "-0.04em", color: "var(--text)", lineHeight: 1 }}>Deliverables</h2>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Button variant="outline" size="sm" onClick={() => setUploading(true)}>
              <Plus className="h-3.5 w-3.5" />
              Upload
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadAll}>
              <Download className="h-3.5 w-3.5" />
              Download All
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard label="Total Files"  value={loading ? "—" : String(displayed.length)} />
          <StatCard label="This Month"   value={loading ? "—" : String(thisMonth || (realCount > 0 ? thisMonth : 3))} />
          <StatCard label="Total Size"   value={loading ? "—" : (realCount > 0 ? humanTotal : "437 MB")} />
        </div>

        {/* File list */}
        <div className="rounded-[18px] overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--surface)", boxShadow: "var(--shadow-card)" }}>
          <div className="px-5 sm:px-7 py-4 sm:py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="section-label">All Files</span>
            <span style={{ fontSize: 11, color: "var(--text-6)" }}>{displayed.length} deliverables</span>
          </div>

          {displayed.map((d, i) => (
            <DeliverableRow
              key={d.id}
              d={d}
              index={i}
              isLast={i === displayed.length - 1}
              onView={()     => setViewing(d)}
              onDownload={()  => handleDownload(d)}
              onDelete={()    => handleDelete(d)}
            />
          ))}
        </div>

      </div>
    </PagePad>
  );
}
