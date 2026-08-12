import type { SupabaseClient } from "@supabase/supabase-js";
import { completeText } from "@/lib/ai/llm";
import { parseJson } from "./core";

const SYSTEM = `You are AERA's funnel engine. Design a simple, high-converting landing funnel for a brand — the structure only, ready for review before anything goes live.

Rules:
- Match the brand's tone of voice exactly.
- No invented testimonials, statistics, or claims. Offer framing must stay generic unless specifics were provided.
- Keep it to one focused conversion goal.

Respond with STRICT JSON only:
{
  "name": "short internal name",
  "headline": "...",
  "subheadline": "...",
  "offer": "what the visitor gets",
  "cta": "button text",
  "sections": [{"title": "...", "body": "..."}],
  "form_fields": ["first_name", "email"]
}`;

export async function draftFunnel(sb: SupabaseClient, brandId: string, brief?: string) {
  const { data: brand } = await sb
    .from("brands")
    .select("name,tone_of_voice,target_audience,website_url")
    .eq("id", brandId)
    .single();
  if (!brand) throw new Error("Brand not found");

  const prompt = [
    `Brand: ${brand.name}`,
    `Tone of voice: ${brand.tone_of_voice ?? "not specified"}`,
    `Target audience: ${brand.target_audience ?? "not specified"}`,
    brief ? `Campaign brief: ${brief}` : `No specific campaign brief — design a general lead-capture funnel for this brand.`,
  ].join("\n");

  const raw = await completeText({ system: SYSTEM, messages: [{ role: "user", content: prompt }], maxTokens: 1200 });
  const structure = parseJson<{ name?: string }>(raw);

  const { data, error } = await sb
    .from("funnels")
    .insert({
      brand_id: brandId,
      name: structure.name ?? `${brand.name} funnel`,
      status: "draft",
      structure,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}
