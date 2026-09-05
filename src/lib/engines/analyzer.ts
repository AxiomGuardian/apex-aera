import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText, activeModel } from "@/lib/ai/llm";
import { voiceBlock } from "./voice";
import { parseJson } from "./core";

/** Transcribe a video's audio via Deepgram (URL-based, uses existing key). */
async function transcribeVideo(sb: SupabaseClient, storagePath: string): Promise<string | null> {
  if (!process.env.DEEPGRAM_API_KEY) return null;
  try {
    const { data: signed } = await sb.storage.from("media").createSignedUrl(storagePath, 600);
    if (!signed?.signedUrl) return null;
    const res = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: signed.signedUrl }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
    };
    const t = j.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return t.trim() || null;
  } catch {
    return null;
  }
}

const SYSTEM = `You are AERA's content analysis engine for a premium marketing intelligence platform.

You are given a brand profile and one finished content asset (its metadata, and the image itself when the asset is a photo/graphic). Recommend how to distribute it.

Rules:
- Base every claim on what you actually know (format, duration, the image if provided, and the brand profile). Do NOT invent facts about content you cannot see.
- brand_voice_score: only score 0-100 if you can genuinely evaluate voice/visual fit. Otherwise use null.
- Platforms allowed: instagram, facebook, tiktok, youtube, linkedin, x, google_business.
- fit must be one of: strong, moderate, low.
- posting_windows: day + local time ranges with a short reason.

Respond with STRICT JSON only — no markdown fences, no commentary:
{
  "platform_recommendations": [{"platform": "...", "fit": "...", "reason": "..."}],
  "targeting": {"demographics": ["..."], "interests": ["..."]},
  "posting_windows": [{"platform": "...", "day": "...", "time": "...", "reason": "..."}],
  "brand_voice_score": null,
  "summary": "2-3 sentence plain-language recommendation for the client"
}`;

export async function analyzeAsset(sb: SupabaseClient, assetId: string) {
  const { data: asset } = await sb
    .from("content_assets")
    .select("id,brand_id,type,status,title,description,transcript,storage_path,duration_seconds,metadata")
    .eq("id", assetId)
    .single();
  if (!asset) throw new Error("Asset not found");

  const { data: brand } = await sb
    .from("brands")
    .select("name,tone_of_voice,target_audience,website_url,voice_profile,voice_confirmed_at")
    .eq("id", asset.brand_id)
    .single();

  await sb.from("content_assets").update({ status: "analyzing" }).eq("id", asset.id);

  try {
    const meta = (asset.metadata ?? {}) as { size?: number; mime?: string; frames?: string[] };

    // ── Video understanding: transcript (audio) ──
    let transcript: string | null = asset.transcript ?? null;
    if (!transcript && asset.type.startsWith("video") && asset.storage_path) {
      transcript = await transcribeVideo(sb, asset.storage_path);
      if (transcript) {
        await sb.from("content_assets").update({ transcript }).eq("id", asset.id);
      }
    }
    const lines = [
      `BRAND PROFILE`,
      `Name: ${brand?.name ?? "Unknown"}`,
      `Tone of voice: ${brand?.tone_of_voice ?? "not specified"}`,
      `Target audience: ${brand?.target_audience ?? "not specified"}`,
      brand?.voice_confirmed_at ? voiceBlock(brand.voice_profile) : "",
      ``,
      `ASSET`,
      `Title: ${asset.title ?? "Untitled"}`,
      asset.description ? `What's in it (from the creator): ${asset.description}` : ``,
      `Type: ${asset.type}`,
      asset.duration_seconds ? `Duration: ${asset.duration_seconds}s` : ``,
      meta.mime ? `Format: ${meta.mime}` : ``,
      transcript ? `` : ``,
      transcript ? `TRANSCRIPT (what is said in the video): ${transcript.slice(0, 4000)}` : ``,
      meta.frames?.length ? `Attached: ${meta.frames.length} still frames captured from the video — analyze them as what the video looks like.` : ``,
    ].filter(Boolean);

    const imageUrls: string[] = [];
    const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (asset.type === "image" && asset.storage_path && meta.mime && IMAGE_MIMES.includes(meta.mime)) {
      const { data: signed } = await sb.storage.from("media").createSignedUrl(asset.storage_path, 120);
      if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
    }
    // Video keyframes (captured at upload) → AERA sees the video
    for (const framePath of meta.frames ?? []) {
      const { data: signed } = await sb.storage.from("thumbnails").createSignedUrl(framePath, 120);
      if (signed?.signedUrl) imageUrls.push(signed.signedUrl);
    }

    const raw = await completeText({
      system: SYSTEM,
      messages: [{ role: "user", content: lines.join("\n") }],
      maxTokens: 1500,
      imageUrls,
    });
    const parsed = parseJson<Record<string, unknown>>(raw);

    const { data: analysis, error } = await sb
      .from("analyses")
      .insert({
        asset_id: asset.id,
        brand_id: asset.brand_id,
        platform_recommendations: parsed.platform_recommendations ?? null,
        targeting: parsed.targeting ?? null,
        posting_windows: parsed.posting_windows ?? null,
        brand_voice_score: (parsed.brand_voice_score as number | null) ?? null,
        summary: (parsed.summary as string) ?? null,
        model: activeModel(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    await sb.from("content_assets").update({ status: "analyzed" }).eq("id", asset.id);
    return analysis;
  } catch (err) {
    await sb.from("content_assets").update({ status: "uploaded" }).eq("id", asset.id);
    throw err;
  }
}
