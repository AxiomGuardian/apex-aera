/**
 * APEX AERA Agent Registry
 *
 * Five specialist agents + AERA (chair) — each with a unique ElevenLabs voice,
 * a defined role within Mitchell's workflow, and a personality signature.
 *
 * Voice IDs are permanent ElevenLabs voice clone references.
 * These IDs are safe to expose client-side (they are not API keys).
 *
 * Workflow ownership maps to Mitchell's 4 core workflows:
 *   1. Campaign Launch    → Julian (executor) + Marcus (paid performance)
 *   2. Brand Governance   → Sophia (brand guardian)
 *   3. Client Strategy    → Charlotte (relationship) + AERA (chair)
 *   4. Systems & Reporting → Victor Voss (orchestrator)
 */

export type AgentId = "aera" | "marcus" | "sophia" | "julian" | "charlotte" | "victor";

export interface Agent {
  id:          AgentId;
  name:        string;
  voice_id:    string;
  role:        string;
  workflow:    string;
  specialty:   string;
  description: string;
  color:       string;   // accent color for UI
  initials:    string;
  /** TTS playback speed override (default 1.25 in conference room) */
  ttsSpeed?:   number;
  /** Inter-segment pause after this agent finishes speaking (ms, default 100) */
  pauseAfter?: number;
}

export const AGENTS: Record<AgentId, Agent> = {
  aera: {
    id:          "aera",
    name:        "Sarah",              // Voice character name — AERA is the intelligence layer brand
    voice_id:    "NtS6nEHDYMQC9QczMQuq", // Katherine — Calm Luxury · Narration · English
    role:        "Intelligence Chair",
    workflow:    "Client Strategy",
    specialty:   "Brand strategy, performance synthesis, team orchestration",
    description: "The voice of APEX AERA. Sarah chairs every team meeting, synthesizes campaign intelligence, and delivers strategic direction — she's the through-line in every workflow.",
    color:       "#2DD4FF",
    initials:    "SA",
  },
  marcus: {
    id:          "marcus",
    name:        "Marcus",
    voice_id:    "20ErAk3gwcDeRWFcV85t",
    role:        "Ad Optimizer",
    workflow:    "Campaign Launch",
    specialty:   "Paid media, ROAS optimization, audience targeting",
    description: "Paid performance specialist. Marcus owns every dollar of ad spend — Meta, Google, programmatic — and surfaces the highest-leverage bid optimizations in real time.",
    color:       "#F59E0B",
    initials:    "MA",
  },
  sophia: {
    id:          "sophia",
    name:        "Sophia",
    voice_id:    "jB2lPb5DhAX6l1TLkKXy",
    role:        "Brand Guardian",
    workflow:    "Brand Governance",
    specialty:   "Brand consistency, tone of voice, creative QA",
    description: "Brand integrity specialist. Sophia monitors every creative asset for brand alignment, flags inconsistencies before they reach clients, and maintains the 94% brand consistency score.",
    color:       "#A78BFA",
    initials:    "SO",
  },
  julian: {
    id:          "julian",
    name:        "Julian",
    voice_id:    "9IzcwKmvwJcw58h3KnlH",
    role:        "Campaign Executor",
    workflow:    "Campaign Launch",
    specialty:   "Campaign operations, launch sequencing, cross-channel coordination",
    description: "Operations lead. Julian manages launch timelines, coordinates cross-channel creative delivery, and ensures every campaign goes live on schedule without scope drift.",
    color:       "#34D399",
    initials:    "JU",
  },
  charlotte: {
    id:          "charlotte",
    name:        "Charlotte",
    voice_id:    "6fZce9LFNG3iEITDfqZZ",
    role:        "Client Relationship",
    workflow:    "Client Strategy",
    specialty:   "Client communication, reporting, relationship management",
    description: "Client experience lead. Charlotte owns all client touchpoints, prepares executive-ready briefings, and ensures you always feel in control of your campaign portfolio.",
    color:       "#F472B6",
    initials:    "CH",
  },
  victor: {
    id:          "victor",
    name:        "Victor Voss",
    voice_id:    "KSGYe0fMqoZR5BREvtf1",
    role:        "Systems Orchestrator",
    workflow:    "Systems & Reporting",
    specialty:   "Data pipelines, automation, reporting infrastructure",
    description: "Infrastructure architect. Victor Voss builds and maintains the data systems that power AERA's intelligence — attribution pipelines, automated reporting, and the APEX analytics layer.",
    color:       "#60A5FA",
    initials:    "VV",
    // Victor speaks more deliberately — slower speed gives him the measured, architectural
    // pause pattern that fits his character vs. the energetic default 1.25×
    ttsSpeed:    0.92,
    pauseAfter:  380,  // longer gap after Victor so his weight lands before the next speaker
  },
};

export const AGENT_LIST: Agent[] = Object.values(AGENTS);

/** Ordered list for UI display: AERA first, then specialists */
export const AGENT_DISPLAY_ORDER: AgentId[] = [
  "aera", "marcus", "sophia", "julian", "charlotte", "victor",
];

export function getAgent(id: AgentId): Agent {
  return AGENTS[id];
}

export function getAgentByVoiceId(voiceId: string): Agent | undefined {
  return AGENT_LIST.find((a) => a.voice_id === voiceId);
}

/** Convert hex color to "r,g,b" string for use inside rgba() */
export function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "45,212,255";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

/**
 * Parse an AERA response containing **AgentName:** labels into
 * sequential segments for conference room TTS playback.
 *
 * Handles:
 *   **Marcus:** some text       → { agentId: "marcus", text: "some text" }
 *   **Victor Voss:** some text  → { agentId: "victor", text: "some text" }
 *   (anything else)             → { agentId: "aera",   text: "..." }
 */
export type AgentSegment = { agentId: AgentId; text: string };

const NAME_MAP: Record<string, AgentId> = {
  "sarah": "aera", "aera": "aera",
  "marcus": "marcus",
  "sophia": "sophia",
  "julian": "julian",
  "charlotte": "charlotte",
  "victor": "victor", "victor voss": "victor",
};

export function parseAgentSegments(text: string): AgentSegment[] {
  const segments: AgentSegment[] = [];
  // Split on **Name:** boundaries (keeping the delimiter)
  const parts = text.split(/(\*\*[\w\s]+:\*\*)/g);
  let currentAgent: AgentId = "aera";

  for (const part of parts) {
    const labelMatch = part.match(/^\*\*([\w\s]+):\*\*$/);
    if (labelMatch) {
      const normalized = labelMatch[1].toLowerCase().trim();
      currentAgent = NAME_MAP[normalized] ?? "aera";
    } else {
      const cleaned = part.replace(/\n+/g, " ").trim();
      if (cleaned) {
        // Merge with previous segment if same speaker, else push new
        const last = segments[segments.length - 1];
        if (last && last.agentId === currentAgent) {
          last.text += " " + cleaned;
        } else {
          segments.push({ agentId: currentAgent, text: cleaned });
        }
      }
    }
  }

  return segments;
}
