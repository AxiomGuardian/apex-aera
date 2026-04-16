"use client";

/**
 * ClientMemory — Persistent localStorage memory for APEX AERA
 *
 * Stores four layers:
 *  1. brandProfile    — voice guidelines, tone, positioning
 *  2. campaignStats   — live metrics (ROAS, velocity, brand score, etc.)
 *  3. recentInsights  — key takeaways extracted from AERA conversations
 *  4. selectedAgentId — which agent voice is active in the chat interface
 */

import {
  createContext, useContext, useState,
  useCallback, useEffect, ReactNode,
} from "react";
import type { AgentId } from "@/lib/agents";

// ── Types ───────────────────────────────────────────────────────

export interface CampaignStats {
  roas:           string;   // e.g. "8.2×"
  velocity:       string;   // e.g. "4.2×"
  brandScore:     string;   // e.g. "94%"
  openRate:       string;   // e.g. "38%"
  cpa:            string;   // e.g. "$18"
  seoLift:        string;   // e.g. "+2,400"
  awarenessDelta: string;   // e.g. "+11 pts"
  updatedAt:      string;   // ISO timestamp
}

export interface BrandProfile {
  clientName:   string;
  voiceTone:    string;   // e.g. "confident, data-driven, premium"
  positioning:  string;
  quarter:      string;   // e.g. "Q2 2026"
  updatedAt:    string;
}

export interface Insight {
  id:        string;
  summary:   string;
  source:    "aera" | "user";
  timestamp: string;
}

interface MemoryState {
  brandProfile:    BrandProfile;
  campaignStats:   CampaignStats;
  recentInsights:  Insight[];   // last 20
  selectedAgentId: AgentId;     // active agent voice — persisted across sessions
}

interface ClientMemoryContextType {
  memory:             MemoryState;
  updateStats:        (partial: Partial<CampaignStats>) => void;
  updateBrand:        (partial: Partial<BrandProfile>) => void;
  addInsight:         (summary: string, source?: "aera" | "user") => void;
  setSelectedAgent:   (id: AgentId) => void;
  resetMemory:        () => void;
}

// ── Defaults ────────────────────────────────────────────────────

const DEFAULT_STATS: CampaignStats = {
  roas:           "—",
  velocity:       "—",
  brandScore:     "—",
  openRate:       "—",
  cpa:            "—",
  seoLift:        "—",
  awarenessDelta: "—",
  updatedAt:      new Date().toISOString(),
};

const DEFAULT_BRAND: BrandProfile = {
  clientName:  "Client",
  voiceTone:   "confident, data-driven, premium",
  positioning: "",
  quarter:     "",
  updatedAt:   new Date().toISOString(),
};

const DEFAULT_MEMORY: MemoryState = {
  brandProfile:    DEFAULT_BRAND,
  campaignStats:   DEFAULT_STATS,
  recentInsights:  [],
  selectedAgentId: "aera",      // default to AERA voice
};

const STORAGE_KEY = "aera_client_memory_v1";

// ── localStorage helpers ────────────────────────────────────────

function load(): MemoryState {
  if (typeof window === "undefined") return DEFAULT_MEMORY;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_MEMORY;
    const parsed = JSON.parse(raw) as Partial<MemoryState>;
    return {
      brandProfile:    { ...DEFAULT_BRAND,  ...(parsed.brandProfile  ?? {}) },
      campaignStats:   { ...DEFAULT_STATS,  ...(parsed.campaignStats  ?? {}) },
      recentInsights:  parsed.recentInsights ?? [],
      selectedAgentId: (parsed.selectedAgentId as AgentId) ?? "aera",
    };
  } catch { return DEFAULT_MEMORY; }
}

function save(state: MemoryState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota */ }
}

// ── Context ─────────────────────────────────────────────────────

const ClientMemoryContext = createContext<ClientMemoryContextType | null>(null);

export function ClientMemoryProvider({ children }: { children: ReactNode }) {
  const [memory, setMemory] = useState<MemoryState>(() => load());

  // Persist every time memory changes
  useEffect(() => { save(memory); }, [memory]);

  const updateStats = useCallback((partial: Partial<CampaignStats>) => {
    setMemory((prev) => ({
      ...prev,
      campaignStats: {
        ...prev.campaignStats,
        ...partial,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const updateBrand = useCallback((partial: Partial<BrandProfile>) => {
    setMemory((prev) => ({
      ...prev,
      brandProfile: {
        ...prev.brandProfile,
        ...partial,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const addInsight = useCallback((summary: string, source: "aera" | "user" = "aera") => {
    if (!summary.trim()) return;
    setMemory((prev) => {
      const insight: Insight = {
        id:        `ins-${Date.now()}`,
        summary:   summary.trim(),
        source,
        timestamp: new Date().toISOString(),
      };
      const updated = [insight, ...prev.recentInsights].slice(0, 20);
      return { ...prev, recentInsights: updated };
    });
  }, []);

  const setSelectedAgent = useCallback((id: AgentId) => {
    setMemory((prev) => ({ ...prev, selectedAgentId: id }));
  }, []);

  const resetMemory = useCallback(() => {
    const fresh: MemoryState = {
      ...DEFAULT_MEMORY,
      campaignStats: { ...DEFAULT_STATS, updatedAt: new Date().toISOString() },
    };
    setMemory(fresh);
    if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ClientMemoryContext.Provider value={{ memory, updateStats, updateBrand, addInsight, setSelectedAgent, resetMemory }}>
      {children}
    </ClientMemoryContext.Provider>
  );
}

export function useClientMemory() {
  const ctx = useContext(ClientMemoryContext);
  if (!ctx) throw new Error("useClientMemory must be used within ClientMemoryProvider");
  return ctx;
}

// ── Utility: extract metrics from AERA response text ─────────────────────────
//
// Handles natural language variations in AERA's responses, e.g.:
//   "ROAS of 8.4×", "8.2x ROAS", "a velocity of 4.5×", "brand score 94%",
//   "brand consistency at 94%", "open rate is 38%", "$17 CPA", "CPA dropped to $14"
//   "organic lift of +2,400", "+11 pts brand awareness"

export function extractMetricsFromText(text: string): Partial<CampaignStats> {
  const updates: Partial<CampaignStats> = {};

  // ── ROAS ─────────────────────────────────────────────────────────────────
  // Matches: "ROAS 8.4×", "ROAS of 8.4x", "8.4× ROAS", "a ROAS of 8.2x",
  //          "return on ad spend of 8.4×", "8.4x return on ad spend"
  const roasPatterns = [
    /(?:ROAS|return\s+on\s+ad\s+spend)\s+(?:of\s+|at\s+|is\s+|:?\s*)(\d+\.?\d*)\s*[×xX]/i,
    /(\d+\.?\d*)\s*[×xX]\s+(?:ROAS|return\s+on\s+ad\s+spend)/i,
  ];
  for (const p of roasPatterns) {
    const m = text.match(p);
    if (m) { updates.roas = `${m[1]}×`; break; }
  }

  // ── Content Velocity ─────────────────────────────────────────────────────
  // Matches: "velocity 4.2×", "content velocity of 4.5x", "4.2× velocity",
  //          "velocity score of 4.2x", "velocity: 4.5×"
  const velPatterns = [
    /(?:content\s+)?velocity\s+(?:score\s+)?(?:of\s+|at\s+|is\s+|:?\s*)(\d+\.?\d*)\s*[×xX]/i,
    /(\d+\.?\d*)\s*[×xX]\s+(?:content\s+)?velocity/i,
  ];
  for (const p of velPatterns) {
    const m = text.match(p);
    if (m) { updates.velocity = `${m[1]}×`; break; }
  }

  // ── Brand Score ───────────────────────────────────────────────────────────
  // Matches: "brand score 94%", "brand consistency 94%", "brand health 94%",
  //          "brand consistency score of 94%", "94% brand consistency",
  //          "brand alignment of 94%", "brand score: 94"
  const brandPatterns = [
    /brand\s+(?:consistency|score|health|alignment|voice|safety)\s+(?:score\s+)?(?:of\s+|at\s+|is\s+|:?\s*)(\d+)\s*%/i,
    /(\d+)\s*%\s+brand\s+(?:consistency|score|health|alignment|voice|safety)/i,
  ];
  for (const p of brandPatterns) {
    const m = text.match(p);
    if (m) { updates.brandScore = `${m[1]}%`; break; }
  }

  // ── Open Rate ─────────────────────────────────────────────────────────────
  // Matches: "open rate 38%", "open rate of 38%", "38% open rate",
  //          "email open rate is 38%"
  const openPatterns = [
    /(?:email\s+)?open\s+rate\s+(?:of\s+|at\s+|is\s+|:?\s*)(\d+)\s*%/i,
    /(\d+)\s*%\s+(?:email\s+)?open\s+rate/i,
  ];
  for (const p of openPatterns) {
    const m = text.match(p);
    if (m) { updates.openRate = `${m[1]}%`; break; }
  }

  // ── CPA ───────────────────────────────────────────────────────────────────
  // Matches: "$17 CPA", "CPA of $17", "CPA: $18", "CPA dropped to $14",
  //          "cost per acquisition of $17", "$14 cost per acquisition"
  const cpaPatterns = [
    /(?:CPA|cost\s+per\s+acquisition)\s+(?:\w+\s+)*\$(\d+(?:\.\d+)?)/i,
    /\$(\d+(?:\.\d+)?)\s+(?:CPA|cost\s+per\s+acquisition)/i,
    /CPA\s*(?:of\s+|at\s+|is\s+|:?\s*)\$(\d+(?:\.\d+)?)/i,
  ];
  for (const p of cpaPatterns) {
    const m = text.match(p);
    if (m) { updates.cpa = `$${m[1]}`; break; }
  }

  // ── SEO / Organic Lift ────────────────────────────────────────────────────
  // Matches: "+2,400 sessions", "organic lift of +2,400", "+2400 organic sessions",
  //          "SEO lift of +2,400"
  const seoPatterns = [
    /(?:organic|SEO)\s+(?:lift|sessions|traffic)\s+(?:of\s+)?\+?([\d,]+)/i,
    /\+([\d,]+)\s+(?:organic|SEO)\s+(?:sessions|lift|traffic)/i,
  ];
  for (const p of seoPatterns) {
    const m = text.match(p);
    if (m) { updates.seoLift = `+${m[1]}`; break; }
  }

  // ── Awareness Delta ───────────────────────────────────────────────────────
  // Matches: "+11 pts brand awareness", "brand awareness up 11 points",
  //          "awareness delta of +11 pts"
  const awarePatterns = [
    /\+(\d+)\s+(?:pts?|points?)\s+(?:brand\s+)?awareness/i,
    /(?:brand\s+)?awareness\s+(?:up|delta(?:\s+of)?)\s+\+?(\d+)\s+(?:pts?|points?)/i,
    /awareness\s+(?:delta\s+of\s+)?\+(\d+)/i,
  ];
  for (const p of awarePatterns) {
    const m = text.match(p);
    if (m) { updates.awarenessDelta = `+${m[1]} pts`; break; }
  }

  return updates;
}
