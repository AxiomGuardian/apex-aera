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
}

export const AGENTS: Record<AgentId, Agent> = {
  aera: {
    id:          "aera",
    name:        "AERA",
    voice_id:    "NtS6nEHDYMQC9QczMQuq", // Katherine — Calm Luxury · Narration · English
    role:        "Intelligence Chair",
    workflow:    "Client Strategy",
    specialty:   "Brand strategy, performance synthesis, team orchestration",
    description: "Your primary APEX intelligence layer. AERA synthesizes all campaign signals, chairs team meetings, and delivers strategic direction across every workflow.",
    color:       "#2DD4FF",
    initials:    "AE",
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
    color:       "#64748B",
    initials:    "VV",
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
