"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Mic, ArrowRight, Zap, Shield, Target, Users, Database, Bot } from "lucide-react";
import { PagePad } from "@/components/layout/PagePad";
import { AGENT_DISPLAY_ORDER, AGENTS } from "@/lib/agents";
import type { AgentId, Agent } from "@/lib/agents";
import { useClientMemory } from "@/context/ClientMemory";

/* ─── Workflow icon map ─────────────────────────────────────── */
const WORKFLOW_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>> = {
  "Campaign Launch":    Zap,
  "Brand Governance":   Shield,
  "Client Strategy":    Users,
  "Systems & Reporting": Database,
};

/* ─── Status badges — all agents are "Active" in the team ────── */
const AGENT_STATUS: Record<AgentId, { label: string; pulse: boolean }> = {
  aera:      { label: "On Call",  pulse: true  },
  marcus:    { label: "Active",   pulse: true  },
  sophia:    { label: "Active",   pulse: true  },
  julian:    { label: "Active",   pulse: true  },
  charlotte: { label: "Active",   pulse: true  },
  victor:    { label: "Active",   pulse: true  },
};

/* ─── Live activity — what each agent is working on right now ─── */
const AGENT_ACTIVITY: Record<AgentId, {
  action: string;        // Short verb phrase
  detail: string;        // Specifics — real numbers, campaign names
  metric?: string;       // Optional live metric
  metricLabel?: string;
  updatedAgo: string;
}> = {
  aera: {
    action:      "Monitoring brand signals",
    detail:      "Q2 Video ROAS spike at 11.4× — flagged for retargeting expansion",
    metric:      "11.4×",
    metricLabel: "Video ROAS",
    updatedAgo:  "Live",
  },
  marcus: {
    action:      "Optimizing Meta bid strategy",
    detail:      "Shifting to 28-day attribution window — projected +1.2× ROAS lift",
    metric:      "+1.2×",
    metricLabel: "Projected lift",
    updatedAgo:  "2 min ago",
  },
  sophia: {
    action:      "Running creative QA review",
    detail:      "2 retargeting assets flagged for tone misalignment with hero video",
    metric:      "94%",
    metricLabel: "Brand score",
    updatedAgo:  "12 min ago",
  },
  julian: {
    action:      "Sequencing Email Phase 2",
    detail:      "7-touch nurture sequence — Thursday launch confirmed, all assets locked",
    metric:      "Thu",
    metricLabel: "Launch",
    updatedAgo:  "1 hr ago",
  },
  charlotte: {
    action:      "Drafting Q2 executive brief",
    detail:      "8-page portfolio summary — delivery scheduled for Friday 9am",
    metric:      "48h",
    metricLabel: "Delivery",
    updatedAgo:  "3 hr ago",
  },
  victor: {
    action:      "Reconciling attribution model",
    detail:      "Cross-channel data sync — Meta → GA4 → APEX pipeline validated",
    metric:      "99.8%",
    metricLabel: "Data accuracy",
    updatedAgo:  "6 hr ago",
  },
};

function AgentCard({
  agent,
  isSelected,
  onSelect,
  onChat,
  index,
}: {
  agent: Agent;
  isSelected: boolean;
  onSelect: () => void;
  onChat: () => void;
  index: number;
}) {
  const [hovered, setHovered] = useState(false);
  const status   = AGENT_STATUS[agent.id];
  const activity = AGENT_ACTIVITY[agent.id];
  const WorkflowIcon = WORKFLOW_ICONS[agent.workflow] ?? Bot;
  const isAera = agent.id === "aera";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col rounded-[20px] overflow-hidden opacity-0 animate-fade-in-up cursor-default"
      style={{
        animationDelay: `${0.05 + index * 0.07}s`,
        animationFillMode: "forwards",
        background: isSelected
          ? `linear-gradient(145deg, rgba(${hexToRgb(agent.color)}, 0.06) 0%, var(--surface) 60%)`
          : hovered
          ? `rgba(${hexToRgb(agent.color)}, 0.04)`
          : "var(--surface)",
        border: `1px solid ${isSelected ? `rgba(${hexToRgb(agent.color)}, 0.25)` : hovered ? `rgba(${hexToRgb(agent.color)}, 0.22)` : "var(--border)"}`,
        boxShadow: isSelected
          ? `0 0 0 1px rgba(${hexToRgb(agent.color)}, 0.10), var(--shadow-card-hover)`
          : hovered
          ? "var(--shadow-card-hover)"
          : "var(--shadow-card)",
        transition: "all 0.25s",
        padding: "28px 26px 24px",
      }}
    >
      {/* Top edge accent — shows when selected */}
      <div style={{
        position: "absolute",
        top: 0, left: "15%", right: "15%",
        height: 1,
        background: `linear-gradient(90deg, transparent, ${agent.color}60, transparent)`,
        opacity: isSelected ? 1 : hovered ? 0.5 : 0,
        transition: "opacity 0.25s",
      }} />

      {/* Left accent stripe — shows when selected */}
      <div style={{
        position: "absolute",
        left: 0, top: 16, bottom: 16,
        width: 2, borderRadius: 2,
        background: `linear-gradient(180deg, ${agent.color}, ${agent.color}30)`,
        opacity: isSelected ? 0.7 : 0,
        transition: "opacity 0.25s",
      }} />

      {/* Header row */}
      <div className="flex items-start justify-between mb-5">
        {/* Avatar */}
        <div className="relative">
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: isSelected
              ? `rgba(${hexToRgb(agent.color)}, 0.10)`
              : hovered ? `rgba(${hexToRgb(agent.color)}, 0.08)` : "var(--surface-2)",
            border: `1px solid ${isSelected ? `rgba(${hexToRgb(agent.color)}, 0.22)` : hovered ? `rgba(${hexToRgb(agent.color)}, 0.18)` : "var(--border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.22s",
          }}>
            <span style={{
              fontSize: 13, fontWeight: 800,
              letterSpacing: "-0.02em",
              color: isSelected ? agent.color : hovered ? agent.color : "var(--text-4)",
              transition: "color 0.22s",
            }}>
              {agent.initials}
            </span>
          </div>
          {/* Online pulse */}
          <div style={{
            position: "absolute", bottom: 1, right: 1,
            width: 9, height: 9, borderRadius: "50%",
            background: status.pulse ? "#22c55e" : "var(--surface-3)",
            boxShadow: status.pulse ? "0 0 5px rgba(34,197,94,0.55)" : "none",
            border: "1.5px solid var(--surface)",
            animation: status.pulse ? "breathe 2.4s ease-in-out infinite" : "none",
          }} />
        </div>

        {/* Status badge */}
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: "0.09em",
          textTransform: "uppercase",
          padding: "4px 10px", borderRadius: 20,
          color: status.pulse ? "#22c55e" : "var(--text-6)",
          background: status.pulse ? "rgba(34,197,94,0.07)" : "var(--surface-2)",
          border: `1px solid ${status.pulse ? "rgba(34,197,94,0.16)" : "var(--border)"}`,
        }}>
          {status.label}
        </span>
      </div>

      {/* Name + role */}
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-1">
          <h3 style={{
            fontSize: 17, fontWeight: 800, letterSpacing: "-0.04em",
            color: isSelected ? agent.color : "var(--text)",
            lineHeight: 1,
            transition: "color 0.22s",
          }}>
            {agent.name}
          </h3>
          {isAera && (
            <span style={{
              fontSize: 8, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "2px 7px", borderRadius: 10,
              color: "var(--cyan)", background: "rgba(45,212,255,0.08)",
              border: "1px solid rgba(45,212,255,0.16)",
            }}>
              Chair
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: "var(--text-5)", letterSpacing: "0.005em" }}>
          {agent.role}
        </p>
      </div>

      {/* Workflow tag */}
      <div className="flex items-center gap-1.5 mb-4">
        <WorkflowIcon
          className="h-[10px] w-[10px]"
          style={{ color: "var(--text-6)" }}
          strokeWidth={1.6}
        />
        <span style={{ fontSize: 10, color: "var(--text-6)", letterSpacing: "0.04em" }}>
          {agent.workflow}
        </span>
      </div>

      {/* Description */}
      <p style={{
        fontSize: 12, color: "var(--text-5)", lineHeight: 1.7,
        letterSpacing: "0.005em",
      }}>
        {agent.description}
      </p>

      {/* ── Live Activity ── */}
      <div style={{
        marginTop: 14,
        padding: "12px 14px",
        borderRadius: 10,
        background: hovered || isSelected
          ? `rgba(${hexToRgb(agent.color)}, 0.05)`
          : "var(--surface-2)",
        border: `1px solid ${hovered || isSelected
          ? `rgba(${hexToRgb(agent.color)}, 0.14)`
          : "var(--border)"}`,
        transition: "all 0.25s",
      }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {/* Live pulse */}
            <span style={{
              width: 5, height: 5, borderRadius: "50%",
              background: status.pulse ? "#22c55e" : "var(--text-6)",
              boxShadow: status.pulse ? "0 0 4px rgba(34,197,94,0.6)" : "none",
              flexShrink: 0,
              display: "block",
            }} />
            <span style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: hovered || isSelected ? agent.color : "var(--text-5)",
              transition: "color 0.25s",
            }}>
              {activity.action}
            </span>
          </div>
          <span style={{ fontSize: 8, color: "var(--text-6)", letterSpacing: "0.04em" }}>
            {activity.updatedAgo}
          </span>
        </div>

        <p style={{ fontSize: 11, color: "var(--text-5)", lineHeight: 1.6, letterSpacing: "0.005em" }}>
          {activity.detail}
        </p>

        {/* Metric badge */}
        {activity.metric && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{
              fontSize: 16, fontWeight: 800, letterSpacing: "-0.04em",
              color: agent.color,
              fontFeatureSettings: '"tnum"',
            }}>
              {activity.metric}
            </span>
            <span style={{ fontSize: 9.5, color: "var(--text-6)", letterSpacing: "0.03em" }}>
              {activity.metricLabel}
            </span>
          </div>
        )}
      </div>

      {/* Specialty tags */}
      <div className="flex flex-wrap gap-1.5 mt-4 mb-5">
        {agent.specialty.split(", ").map((tag) => (
          <span key={tag} style={{
            fontSize: 9, fontWeight: 500,
            padding: "3px 8px", borderRadius: 6,
            color: "var(--text-5)",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            letterSpacing: "0.02em",
          }}>
            {tag}
          </span>
        ))}
      </div>

      {/* CTA buttons */}
      <div className="flex gap-2 mt-auto">
        {/* Select as voice */}
        <button
          onClick={onSelect}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 9,
            border: `1px solid ${isSelected ? `rgba(${hexToRgb(agent.color)}, 0.28)` : "var(--border)"}`,
            background: isSelected ? `rgba(${hexToRgb(agent.color)}, 0.08)` : "transparent",
            color: isSelected ? agent.color : "var(--text-4)",
            fontSize: 11, fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: "pointer",
            transition: "all 0.18s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.borderColor = "var(--border-mid)";
              e.currentTarget.style.color = "var(--text-2)";
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-4)";
            }
          }}
        >
          <Mic style={{ width: 11, height: 11 }} strokeWidth={1.6} />
          {isSelected ? "Voice Active" : "Set Voice"}
        </button>

        {/* Chat with agent */}
        <button
          onClick={onChat}
          style={{
            flex: 1,
            height: 34,
            borderRadius: 9,
            border: "1px solid rgba(45,212,255,0.16)",
            background: "rgba(45,212,255,0.06)",
            color: "var(--cyan)",
            fontSize: 11, fontWeight: 600,
            letterSpacing: "0.02em",
            cursor: "pointer",
            transition: "all 0.18s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(45,212,255,0.10)";
            e.currentTarget.style.borderColor = "rgba(45,212,255,0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(45,212,255,0.06)";
            e.currentTarget.style.borderColor = "rgba(45,212,255,0.16)";
          }}
        >
          <MessageSquare style={{ width: 11, height: 11 }} strokeWidth={1.6} />
          Chat
        </button>
      </div>
    </div>
  );
}

function TeamMeetingBanner({
  onStart,
}: {
  onStart: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onStart}
      className="relative rounded-[18px] overflow-hidden cursor-pointer opacity-0 animate-fade-in-up"
      style={{
        animationDelay: "0.1s",
        animationFillMode: "forwards",
        background: hovered
          ? "linear-gradient(135deg, rgba(45,212,255,0.06) 0%, rgba(45,212,255,0.02) 100%)"
          : "var(--surface)",
        border: `1px solid ${hovered ? "rgba(45,212,255,0.20)" : "var(--border)"}`,
        boxShadow: hovered ? "var(--shadow-card-hover)" : "var(--shadow-card)",
        padding: "24px 28px",
        transition: "all 0.25s",
      }}
    >
      {/* Gradient bar */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: 1,
        background: "linear-gradient(90deg, transparent, rgba(45,212,255,0.45), transparent)",
        opacity: hovered ? 1 : 0.3,
        transition: "opacity 0.25s",
      }} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Agent micro-avatars */}
          <div className="flex items-center">
            {AGENT_DISPLAY_ORDER.map((id, i) => (
              <div key={id} style={{
                width: 30, height: 30, borderRadius: "50%",
                background: `rgba(${hexToRgb(AGENTS[id].color)}, 0.12)`,
                border: `1.5px solid ${AGENTS[id].color}44`,
                display: "flex", alignItems: "center", justifyContent: "center",
                marginLeft: i === 0 ? 0 : -8,
                zIndex: AGENT_DISPLAY_ORDER.length - i,
                position: "relative",
              }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: AGENTS[id].color }}>
                  {AGENTS[id].initials}
                </span>
              </div>
            ))}
          </div>

          <div>
            <h3 style={{
              fontSize: 15, fontWeight: 800, letterSpacing: "-0.035em",
              color: "var(--text)", lineHeight: 1,
            }}>
              Start Team Meeting
            </h3>
            <p style={{ fontSize: 12, color: "var(--text-5)", marginTop: 5, lineHeight: 1.5 }}>
              AERA chairs a voice meeting with all 5 specialists — natural handoffs, real-time strategy.
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-2 shrink-0"
          style={{
            padding: "8px 16px", borderRadius: 10,
            background: hovered ? "rgba(45,212,255,0.10)" : "rgba(45,212,255,0.06)",
            border: "1px solid rgba(45,212,255,0.16)",
            color: "var(--cyan)",
            fontSize: 12, fontWeight: 600,
            transition: "all 0.2s",
          }}
        >
          <Mic style={{ width: 13, height: 13 }} strokeWidth={1.6} />
          Voice Session
          <ArrowRight style={{ width: 13, height: 13 }} strokeWidth={2} />
        </div>
      </div>
    </div>
  );
}

/** Convert hex color to "r,g,b" string for rgba() */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "45,212,255";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}

export default function AgentsPage() {
  const router = useRouter();
  const { memory, setSelectedAgent } = useClientMemory();
  const selectedAgentId = memory.selectedAgentId;

  const handleSelectAgent = (id: AgentId) => {
    setSelectedAgent(id);
  };

  const handleChatWithAgent = (agent: Agent) => {
    // Select this agent's voice then navigate to chat
    setSelectedAgent(agent.id);
    router.push(`/chat?agent=${agent.id}`);
  };

  const handleStartMeeting = () => {
    // Set AERA as chair and open voice mode in chat
    setSelectedAgent("aera");
    router.push("/chat?meeting=1");
  };

  const selectedAgent = AGENTS[selectedAgentId];

  return (
    <PagePad>
      <div
        className="flex flex-col gap-8 sm:gap-10 opacity-0 animate-fade-in-up"
        style={{ animationFillMode: "forwards" }}
      >
        {/* Header */}
        <div>
          <p className="label-eyebrow mb-2.5">APEX Intelligence Team</p>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2
                style={{
                  fontSize: "clamp(26px, 4vw, 32px)",
                  fontWeight: 800,
                  letterSpacing: "-0.045em",
                  color: "var(--text)",
                  lineHeight: 1,
                }}
              >
                Agent Team
              </h2>
              <p style={{
                fontSize: 14, color: "var(--text-5)",
                marginTop: 12, fontWeight: 400, lineHeight: 1.6,
                letterSpacing: "0.005em", maxWidth: 440,
              }}>
                Five specialist agents, each with a distinct voice and workflow domain. Select a voice for your AERA sessions or open a direct conversation.
              </p>
            </div>

            {/* Active voice indicator */}
            <div
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", borderRadius: 12,
                background: "var(--surface)",
                border: `1px solid rgba(${hexToRgb(selectedAgent.color)}, 0.20)`,
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: selectedAgent.color,
                boxShadow: `0 0 6px ${selectedAgent.color}88`,
                animation: "breathe 2.4s ease-in-out infinite",
              }} />
              <div>
                <p style={{ fontSize: 9, color: "var(--text-6)", letterSpacing: "0.10em", textTransform: "uppercase" }}>
                  Active Voice
                </p>
                <p style={{ fontSize: 12, fontWeight: 700, color: selectedAgent.color, letterSpacing: "-0.02em", lineHeight: 1 }}>
                  {selectedAgent.name}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Meeting CTA */}
        <TeamMeetingBanner onStart={handleStartMeeting} />

        {/* Agent Grid */}
        <div>
          <p className="label-eyebrow mb-5">Specialist Agents</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {AGENT_DISPLAY_ORDER.map((id, i) => (
              <AgentCard
                key={id}
                agent={AGENTS[id]}
                isSelected={selectedAgentId === id}
                onSelect={() => handleSelectAgent(id)}
                onChat={() => handleChatWithAgent(AGENTS[id])}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Workflow map */}
        <div
          style={{
            padding: "24px 28px",
            borderRadius: 16,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <p className="label-eyebrow mb-4">Workflow Ownership</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(WORKFLOW_ICONS).map(([workflow, Icon]) => {
              const workflowAgents = AGENT_DISPLAY_ORDER
                .map((id) => AGENTS[id])
                .filter((a) => a.workflow === workflow);
              return (
                <div key={workflow} style={{
                  padding: "14px 16px", borderRadius: 12,
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-[12px] w-[12px]" style={{ color: "var(--text-5)" }} strokeWidth={1.6} />
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-4)", letterSpacing: "0.04em" }}>
                      {workflow}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {workflowAgents.map((a) => (
                      <div key={a.id} className="flex items-center gap-2">
                        <div style={{
                          width: 5, height: 5, borderRadius: "50%",
                          background: a.color, flexShrink: 0,
                        }} />
                        <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>{a.name}</span>
                        <span style={{ fontSize: 10, color: "var(--text-6)" }}>— {a.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </PagePad>
  );
}
