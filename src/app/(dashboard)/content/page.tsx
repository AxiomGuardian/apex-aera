"use client";

/**
 * Content Engine — Phase: muscle.
 * Upload finished media → Supabase Storage (media bucket) → content_assets row.
 * Next stage: AERA analysis (platform recommendations) per asset.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { PagePad } from "@/components/layout/PagePad";
import {
  Upload, FileText, CheckCircle2, Loader2, AlertCircle, Video, Image as ImageIcon, Trash2,
} from "lucide-react";
import { DictateButton } from "@/components/voice/DictateButton";

type Brand = { id: string; name: string };

type Rec = { platform: string; fit: string; reason: string };
type Win = { platform?: string; day: string; time: string; reason?: string };
type Analysis = {
  id: string;
  asset_id: string;
  platform_recommendations: Rec[] | null;
  targeting: { demographics?: string[]; interests?: string[] } | null;
  posting_windows: Win[] | null;
  brand_voice_score: number | null;
  summary: string | null;
};

type AssetRow = {
  id: string;
  title: string | null;
  type: string;
  status: string;
  storage_path: string | null;
  duration_seconds: number | null;
  created_at: string;
  metadata: { size?: number; mime?: string } | null;
};

const TYPE_LABEL: Record<string, string> = {
  video_short: "Short Video",
  video_long:  "Long Video",
  image:       "Image",
  carousel:    "Carousel",
  other:       "File",
};

const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  uploaded:  { color: "#2DD4FF", bg: "rgba(45,212,255,0.08)" },
  analyzing: { color: "#F59E0B", bg: "rgba(245,158,11,0.08)" },
  analyzed:  { color: "#34D399", bg: "rgba(52,211,153,0.08)" },
  scheduled: { color: "#A78BFA", bg: "rgba(167,139,250,0.08)" },
  published: { color: "#34D399", bg: "rgba(52,211,153,0.08)" },
  archived:  { color: "#737373", bg: "rgba(115,115,115,0.08)" },
};

function fmtMST(iso: string) {
  return (
    new Date(iso).toLocaleString("en-US", {
      timeZone: "America/Phoenix",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " MST"
  );
}

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000)     return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/** Classify a video file by duration (≤ 90s = short-form). */
function classifyVideo(file: File): Promise<{ type: string; duration: number | null }> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const v = document.createElement("video");
      v.preload = "metadata";
      const done = (type: string, duration: number | null) => {
        URL.revokeObjectURL(url);
        resolve({ type, duration });
      };
      v.onloadedmetadata = () => {
        const d = Number.isFinite(v.duration) ? Math.round(v.duration) : null;
        done(d !== null && d <= 90 ? "video_short" : "video_long", d);
      };
      v.onerror = () => done("video_long", null);
      v.src = url;
    } catch {
      resolve({ type: "video_long", duration: null });
    }
  });
}

/** Capture still frames from a video (10%, 45%, 80%) so AERA can SEE it. */
function extractFrames(file: File): Promise<Blob[]> {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "auto";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      const done = (frames: Blob[]) => {
        URL.revokeObjectURL(url);
        resolve(frames);
      };
      video.onerror = () => done([]);
      video.onloadedmetadata = async () => {
        try {
          if (!Number.isFinite(video.duration) || video.duration <= 0) return done([]);
          const canvas = document.createElement("canvas");
          const w = Math.min(video.videoWidth || 1280, 1280);
          canvas.width = w;
          canvas.height = Math.round(w * ((video.videoHeight || 720) / (video.videoWidth || 1280)));
          const ctx = canvas.getContext("2d");
          if (!ctx) return done([]);
          const frames: Blob[] = [];
          for (const point of [0.1, 0.45, 0.8]) {
            await new Promise<void>((r) => {
              const onSeek = () => { video.removeEventListener("seeked", onSeek); r(); };
              video.addEventListener("seeked", onSeek);
              video.currentTime = video.duration * point;
              setTimeout(() => { video.removeEventListener("seeked", onSeek); r(); }, 3000);
            });
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
            if (blob) frames.push(blob);
          }
          done(frames);
        } catch {
          done([]);
        }
      };
    } catch {
      resolve([]);
    }
  });
}

export default function ContentPage() {
  const [brands,    setBrands]    = useState<Brand[]>([]);
  const [brandId,   setBrandId]   = useState<string | null>(null);
  const [assets,    setAssets]    = useState<AssetRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState<string | null>(null); // filename while uploading
  const [error,     setError]     = useState<string | null>(null);
  const [analyses,  setAnalyses]   = useState<Record<string, Analysis>>({});
  const [captions,  setCaptions]   = useState<Record<string, { platform: string; text: string; hashtags: string[] }[]>>({});
  const [capBusy,   setCapBusy]    = useState<string | null>(null);
  const [schedBusy, setSchedBusy]  = useState<string | null>(null);
  const [note,      setNote]       = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);
  const [sched,     setSched]      = useState<Record<string, { platform: string; scheduled_at: string; status: string }[]>>({});
  const [analyzing, setAnalyzing]  = useState<string | null>(null);
  const [expanded,  setExpanded]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load brands the signed-in user can access
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("brands")
      .select("id,name")
      .eq("status", "active")
      .order("created_at")
      .then(({ data }) => {
        const list = (data ?? []) as Brand[];
        setBrands(list);
        if (list.length && !brandId) setBrandId(list[0].id);
        if (!list.length) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAssets = useCallback(async (bid: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("content_assets")
      .select("id,title,type,status,storage_path,duration_seconds,created_at,metadata")
      .eq("brand_id", bid)
      .order("created_at", { ascending: false });
    setAssets((data ?? []) as AssetRow[]);
    const { data: an } = await supabase
      .from("analyses")
      .select("id,asset_id,platform_recommendations,targeting,posting_windows,brand_voice_score,summary")
      .eq("brand_id", bid)
      .order("created_at", { ascending: false });
    const map: Record<string, Analysis> = {};
    for (const a of (an ?? []) as Analysis[]) if (!map[a.asset_id]) map[a.asset_id] = a;
    setAnalyses(map);
    const { data: caps } = await supabase
      .from("captions")
      .select("asset_id,platform,text,hashtags,created_at")
      .eq("brand_id", bid)
      .order("created_at", { ascending: false });
    const capMap: Record<string, { platform: string; text: string; hashtags: string[] }[]> = {};
    for (const c of caps ?? []) {
      const list = capMap[c.asset_id] ?? [];
      if (!list.some((x) => x.platform === c.platform)) list.push({ platform: c.platform, text: c.text, hashtags: c.hashtags ?? [] });
      capMap[c.asset_id] = list;
    }
    setCaptions(capMap);
    const { data: sp } = await supabase
      .from("scheduled_posts")
      .select("asset_id,platform,scheduled_at,status")
      .eq("brand_id", bid)
      .order("scheduled_at");
    const spMap: Record<string, { platform: string; scheduled_at: string; status: string }[]> = {};
    for (const post of sp ?? []) {
      (spMap[post.asset_id] = spMap[post.asset_id] ?? []).push(post);
    }
    setSched(spMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (brandId) void refreshAssets(brandId);
  }, [brandId, refreshAssets]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!brandId) return;
    setError(null);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id;
    if (!uid) { setError("You need to be signed in to upload."); return; }

    for (const file of Array.from(files)) {
      setUploading(file.name);
      try {
        // 1) Classify
        let type = "other";
        let duration: number | null = null;
        if (file.type.startsWith("image/")) {
          type = "image";
        } else if (file.type.startsWith("video/")) {
          const c = await classifyVideo(file);
          type = c.type;
          duration = c.duration;
        }

        // 2) Upload to the media bucket — path: {brand_id}/{asset_id}/{filename}
        const assetId = crypto.randomUUID();
        const path = `${brandId}/${assetId}/${file.name}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, file);
        if (upErr) throw new Error(upErr.message);

        // 2b) Video: capture still frames so AERA can see it
        const framePaths: string[] = [];
        if (file.type.startsWith("video/")) {
          const frames = await extractFrames(file);
          for (let fi = 0; fi < frames.length; fi++) {
            const fp = `${brandId}/${assetId}/frame-${fi}.jpg`;
            const { error: fErr } = await supabase.storage.from("thumbnails").upload(fp, frames[fi], { contentType: "image/jpeg" });
            if (!fErr) framePaths.push(fp);
          }
        }

        // 3) Record the asset
        const { error: insErr } = await supabase.from("content_assets").insert({
          id: assetId,
          brand_id: brandId,
          uploaded_by: uid,
          type,
          status: "uploaded",
          title: file.name.replace(/\.[^/.]+$/, ""),
          description: note.trim() || null,
          storage_path: path,
          duration_seconds: duration,
          metadata: { size: file.size, mime: file.type, frames: framePaths },
        });
        if (insErr) throw new Error(insErr.message);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed — try again.");
      }
    }
    setUploading(null);
    setNote("");
    void refreshAssets(brandId);
  }, [brandId, note, refreshAssets]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) void handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const analyze = useCallback(async (assetId: string) => {
    setAnalyzing(assetId);
    setError(null);
    try {
      const res = await fetch("/api/aera/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Analysis failed");
      }
      setExpanded(assetId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed — try again.");
    } finally {
      setAnalyzing(null);
      if (brandId) void refreshAssets(brandId);
    }
  }, [brandId, refreshAssets]);

  const deleteAsset = useCallback(async (asset: AssetRow) => {
    setDeleting(asset.id);
    setError(null);
    try {
      const supabase = createClient();
      if (asset.storage_path) {
        await supabase.storage.from("media").remove([asset.storage_path]);
      }
      const { error: delErr } = await supabase.from("content_assets").delete().eq("id", asset.id);
      if (delErr) throw new Error(delErr.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed — try again.");
    } finally {
      setDeleting(null);
      setConfirmDel(null);
      if (brandId) void refreshAssets(brandId);
    }
  }, [brandId, refreshAssets]);

  const FIT_COLOR: Record<string, string> = { strong: "#34D399", moderate: "#F59E0B", low: "var(--text-6)" };

  const runEngine = useCallback(async (url: string, assetId: string, setBusy: (v: string | null) => void) => {
    setBusy(assetId);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(j.error ?? "Engine failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Engine failed — try again.");
    } finally {
      setBusy(null);
      if (brandId) void refreshAssets(brandId);
    }
  }, [brandId, refreshAssets]);

  const brand = brands.find((b) => b.id === brandId);

  return (
    <PagePad>
      <div className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up" style={{ animationFillMode: "forwards" }}>

        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <p className="label-eyebrow mb-2.5">Content Engine</p>
            <h2 style={{ fontSize: "clamp(26px,4vw,32px)", fontWeight: 800, letterSpacing: "-0.045em", color: "var(--text)", lineHeight: 1 }}>
              Content
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-5)", marginTop: 12, lineHeight: 1.6, maxWidth: 460 }}>
              Upload finished videos and images. AERA analyzes each piece and recommends where and when to publish it.
            </p>
          </div>

          {/* Brand selector */}
          {brands.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border)" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--cyan)", boxShadow: "0 0 6px rgba(45,212,255,0.5)" }} />
              <div>
                <p style={{ fontSize: 9, color: "var(--text-6)", letterSpacing: "0.10em", textTransform: "uppercase" }}>Workspace</p>
                {brands.length === 1 ? (
                  <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{brand?.name}</p>
                ) : (
                  <select
                    value={brandId ?? ""}
                    onChange={(e) => setBrandId(e.target.value)}
                    style={{ background: "transparent", border: "none", color: "var(--text)", fontSize: 12, fontWeight: 700, outline: "none" }}
                  >
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="dash-drop"
          style={{
            borderRadius: 18,
            border: `2px dashed ${uploading ? "rgba(45,212,255,0.4)" : "var(--border)"}`,
            background: uploading ? "rgba(45,212,255,0.03)" : "var(--surface)",
            padding: "44px 24px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
            cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
          }}
        >
          {uploading ? (
            <>
              <Loader2 style={{ width: 26, height: 26, color: "var(--cyan)" }} className="animate-spin" strokeWidth={1.6} />
              <p style={{ fontSize: 14, color: "var(--text-2)" }}>Uploading {uploading}…</p>
              <p style={{ fontSize: 12, color: "var(--text-6)" }}>Stored securely in your workspace</p>
            </>
          ) : (
            <>
              <Upload style={{ width: 26, height: 26, color: "var(--text-5)" }} strokeWidth={1.4} />
              <p style={{ fontSize: 14, color: "var(--text-3)" }}>
                Drop finished content here or <span style={{ color: "var(--cyan)" }}>browse</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-6)" }}>Video (MP4, MOV, WebM) and images (JPG, PNG, WebP) — up to 1 GB</p>
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="video/mp4,video/quicktime,video/webm,image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.length) void handleFiles(e.target.files); e.target.value = ""; }}
          />
        </div>

        {/* What's in it. Feeds AERA's analysis + captions. Type it or say it. */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: -14 }}>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: describe what is in the content, e.g. 'precision drills at the range, slow-mo finish'. Makes AERA's captions sharper, especially for video."
            className="auth-input"
            style={{ fontSize: 13.5 }}
          />
          <DictateButton onText={(t) => setNote((v) => (v.trim() ? v.trim() + " " : "") + t)} size={42} title="Describe it out loud" />
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 10, background: "rgba(251,113,133,0.07)", border: "1px solid rgba(251,113,133,0.18)" }}>
            <AlertCircle style={{ width: 15, height: 15, color: "#fb7185", flexShrink: 0 }} strokeWidth={1.6} />
            <p style={{ fontSize: 13, color: "#fb7185" }}>{error}</p>
          </div>
        )}

        {/* Asset library */}
        <div className="mkt-card mkt-quiet rounded-[18px] overflow-hidden">
          <div className="px-5 sm:px-7 py-4 sm:py-5 flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)" }}>
            <span className="section-label">Library</span>
            <span style={{ fontSize: 11, color: "var(--text-6)" }}>{assets.length} asset{assets.length === 1 ? "" : "s"}</span>
          </div>

          {loading ? (
            <div className="px-8 py-14 text-center">
              <Loader2 className="animate-spin" style={{ width: 18, height: 18, color: "var(--text-5)", margin: "0 auto" }} />
            </div>
          ) : assets.length === 0 ? (
            <div className="px-8 py-14 text-center">
              <p className="text-[14px] font-medium" style={{ color: "var(--text-4)" }}>No content yet.</p>
              <p className="text-[12px] mt-2" style={{ color: "var(--text-6)" }}>
                Upload your first video or image above — AERA takes it from there.
              </p>
            </div>
          ) : (
            assets.map((a, i) => {
              const ss = STATUS_STYLE[a.status] ?? STATUS_STYLE.archived;
              const Icon = a.type.startsWith("video") ? Video : a.type === "image" ? ImageIcon : FileText;
              return (
                <div key={a.id}>
                <div
                  className="flex items-center gap-4 sm:gap-5 px-5 sm:px-7 py-5"
                  style={{ borderBottom: expanded === a.id ? "none" : i < assets.length - 1 ? "1px solid var(--border)" : "none" }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 11, background: "var(--surface-2)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Icon style={{ width: 15, height: 15, color: "var(--text-5)" }} strokeWidth={1.5} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13.5, color: "var(--text-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                      {a.title ?? "Untitled"}
                    </p>
                    <p style={{ fontSize: 11, marginTop: 4, color: "var(--text-6)" }}>
                      {TYPE_LABEL[a.type] ?? a.type}
                      {a.duration_seconds ? ` · ${a.duration_seconds}s` : ""}
                      {a.metadata?.size ? ` · ${fmtSize(a.metadata.size)}` : ""}
                      {" · "}{new Date(a.created_at).toLocaleDateString()}
                      {sched[a.id]?.length ? <span style={{ color: "#34D399" }}>{" · next: "}{fmtMST(sched[a.id][0].scheduled_at)}</span> : null}
                    </p>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "4px 10px", borderRadius: 20, color: ss.color, background: ss.bg, border: `1px solid ${ss.color}30`, flexShrink: 0 }}>
                    {a.status}
                  </span>
                  {a.status === "uploaded" && (
                    <button
                      onClick={() => void analyze(a.id)}
                      disabled={analyzing !== null}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.20)", color: "var(--cyan)", fontSize: 11, fontWeight: 700, cursor: analyzing ? "default" : "pointer", flexShrink: 0 }}
                    >
                      {analyzing === a.id ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : null}
                      {analyzing === a.id ? "AERA is analyzing…" : "Analyze"}
                    </button>
                  )}
                  {confirmDel === a.id ? (
                    <button
                      onClick={() => void deleteAsset(a)}
                      disabled={deleting === a.id}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 9, background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.35)", color: "#fb7185", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                    >
                      {deleting === a.id ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : <Trash2 style={{ width: 11, height: 11 }} />}
                      {deleting === a.id ? "Deleting…" : "Confirm delete"}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setConfirmDel(a.id); setTimeout(() => setConfirmDel((c) => (c === a.id ? null : c)), 4000); }}
                      title="Delete asset"
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, background: "transparent", border: "1px solid var(--border)", color: "var(--text-6)", cursor: "pointer", flexShrink: 0 }}
                    >
                      <Trash2 style={{ width: 12, height: 12 }} strokeWidth={1.6} />
                    </button>
                  )}
                  {a.status === "analyzed" && analyses[a.id] && (
                    <button
                      onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 9, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)", color: "#34D399", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
                    >
                      <CheckCircle2 style={{ width: 11, height: 11 }} strokeWidth={1.8} />
                      {expanded === a.id ? "Hide analysis" : "View analysis"}
                    </button>
                  )}
                </div>
                {expanded === a.id && analyses[a.id] && (
                  <div style={{ padding: "0 28px 22px 76px", borderBottom: i < assets.length - 1 ? "1px solid var(--border)" : "none" }}>
                    <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(45,212,255,0.03)", border: "1px solid rgba(45,212,255,0.10)" }}>
                      {analyses[a.id].summary && (
                        <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.7, marginBottom: 14 }}>{analyses[a.id].summary}</p>
                      )}
                      {analyses[a.id].platform_recommendations && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                          {analyses[a.id].platform_recommendations!.map((r) => (
                            <span key={r.platform} title={r.reason} style={{ fontSize: 10.5, fontWeight: 700, padding: "5px 11px", borderRadius: 20, color: FIT_COLOR[r.fit] ?? "var(--text-4)", background: "var(--surface-2)", border: `1px solid ${(FIT_COLOR[r.fit] ?? "#666")}40`, textTransform: "capitalize" }}>
                              {r.platform.replace("_", " ")} · {r.fit}
                            </span>
                          ))}
                        </div>
                      )}
                      {analyses[a.id].posting_windows && analyses[a.id].posting_windows!.length > 0 && (
                        <div style={{ marginBottom: 4 }}>
                          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 7 }}>Best posting windows</p>
                          {analyses[a.id].posting_windows!.slice(0, 4).map((w, wi) => (
                            <p key={wi} style={{ fontSize: 11.5, color: "var(--text-4)", lineHeight: 1.8 }}>
                              <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{w.day} {w.time}</span>
                              {w.platform ? ` — ${w.platform.replace("_", " ")}` : ""}{w.reason ? ` · ${w.reason}` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                      {analyses[a.id].targeting?.interests && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                          {(analyses[a.id].targeting!.interests ?? []).slice(0, 8).map((t) => (
                            <span key={t} style={{ fontSize: 10, padding: "3px 9px", borderRadius: 6, color: "var(--text-5)", background: "var(--surface-2)", border: "1px solid var(--border)" }}>{t}</span>
                          ))}
                        </div>
                      )}
                      {captions[a.id] && captions[a.id].length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 8 }}>Captions</p>
                          {captions[a.id].map((c) => (
                            <div key={c.platform} style={{ padding: "10px 13px", borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", marginBottom: 8 }}>
                              <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--cyan)", marginBottom: 5 }}>{c.platform.replace("_", " ")}</p>
                              <p style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.text}</p>
                              {c.hashtags.length > 0 && (
                                <p style={{ fontSize: 11, color: "var(--text-5)", marginTop: 5 }}>{c.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {sched[a.id] && sched[a.id].length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-6)", marginBottom: 8 }}>Scheduled</p>
                          {sched[a.id].map((sp, si) => (
                            <p key={si} style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.9 }}>
                              <span style={{ color: "#34D399", fontWeight: 700, textTransform: "capitalize" }}>{sp.platform.replace("_", " ")}</span>
                              {" — "}<span style={{ color: "var(--text-2)", fontWeight: 600 }}>{fmtMST(sp.scheduled_at)}</span>
                              <span style={{ color: "var(--text-6)" }}> · {sp.status}</span>
                            </p>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                        <button
                          onClick={() => void runEngine("/api/aera/captions", a.id, setCapBusy)}
                          disabled={capBusy !== null || schedBusy !== null}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: 9, background: "rgba(45,212,255,0.08)", border: "1px solid rgba(45,212,255,0.2)", color: "var(--cyan)", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                        >
                          {capBusy === a.id ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : null}
                          {capBusy === a.id ? "Writing captions…" : captions[a.id]?.length ? "Regenerate captions" : "Generate captions"}
                        </button>
                        <button
                          onClick={() => void runEngine("/api/aera/schedule", a.id, setSchedBusy)}
                          disabled={capBusy !== null || schedBusy !== null}
                          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", borderRadius: 9, background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.22)", color: "#34D399", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
                        >
                          {schedBusy === a.id ? <Loader2 className="animate-spin" style={{ width: 11, height: 11 }} /> : null}
                          {schedBusy === a.id ? "Scheduling…" : "Schedule"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </PagePad>
  );
}
