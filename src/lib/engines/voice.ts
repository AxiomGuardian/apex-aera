import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText } from "@/lib/ai/llm";
import { parseJson } from "./core";

/**
 * Voice Reader. Turns whatever a client typed or said about their brand
 * (rambling, half sentences, a list of adjectives) into a sharp profile the
 * other engines can use, and shows it back to the client for confirmation.
 */

export type VoiceProfile = {
  summary: string;        // one line, how AERA understood the brand
  signature: string[];    // 3 to 5 words that define the voice
  audience: string;       // one line, the person on the other side of the screen
  avoid: string[];        // 2 to 4 things AERA should never do for this brand
  confidence: "high" | "medium" | "low";
};

const SYSTEM = `You are AERA, the brand companion inside APEX. A client has described their brand in their own words, possibly by speaking out loud. Your job is to show them you understood.

Return ONLY JSON with this shape:
{
  "summary": "one sentence, under 28 words, in second person, how you understand their brand voice",
  "signature": ["3 to 5 single words or two-word phrases that define the voice"],
  "audience": "one sentence, under 24 words, describing the person they are talking to",
  "avoid": ["2 to 4 short things this brand should never sound like or do"],
  "confidence": "high" | "medium" | "low"
}

Rules:
- Infer from what they actually said. Do not invent a personality they did not describe.
- If they gave almost nothing, keep it modest and set confidence to "low".
- No marketing fluff. No em dashes. Plain, confident language.`;

export async function readBrandVoice(sb: SupabaseClient, brandId: string): Promise<VoiceProfile> {
  const { data: brand, error } = await sb
    .from("brands")
    .select("name,tone_of_voice,target_audience,website_url")
    .eq("id", brandId)
    .single();
  if (error || !brand) throw new Error("Brand not found");

  const raw = [
    `Brand name: ${brand.name}`,
    `What they said about tone of voice: ${brand.tone_of_voice?.trim() || "(nothing yet)"}`,
    `What they said about who they talk to: ${brand.target_audience?.trim() || "(nothing yet)"}`,
    brand.website_url ? `Website: ${brand.website_url}` : "",
  ].filter(Boolean).join("\n");

  const out = await completeText({
    system: SYSTEM,
    messages: [{ role: "user", content: raw }],
    maxTokens: 500,
    temperature: 0.4,
  });
  const profile = parseJson<VoiceProfile>(out);

  const clean: VoiceProfile = {
    summary: String(profile.summary ?? "").trim(),
    signature: Array.isArray(profile.signature) ? profile.signature.map(String).slice(0, 5) : [],
    audience: String(profile.audience ?? "").trim(),
    avoid: Array.isArray(profile.avoid) ? profile.avoid.map(String).slice(0, 4) : [],
    confidence: (["high", "medium", "low"].includes(profile.confidence) ? profile.confidence : "medium") as VoiceProfile["confidence"],
  };

  await sb.from("brands").update({ voice_profile: clean, voice_read_at: new Date().toISOString(), voice_confirmed_at: null }).eq("id", brandId);
  return clean;
}

/** Formats the confirmed profile for injection into other engines' prompts. */
export function voiceBlock(profile: VoiceProfile | null | undefined): string {
  if (!profile?.summary) return "";
  return [
    "AERA's understanding of this brand (confirmed by the client):",
    `- Voice: ${profile.summary}`,
    profile.signature.length ? `- Signature: ${profile.signature.join(", ")}` : "",
    profile.audience ? `- Audience: ${profile.audience}` : "",
    profile.avoid.length ? `- Never: ${profile.avoid.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}
