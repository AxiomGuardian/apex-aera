"use client";

/**
 * ThinkingBubble
 *
 * Collapsible reasoning panel that shows AERA's internal thought process
 * before each response. Powered by Claude's extended thinking API.
 *
 * Collapsed: shows a teaser preview of the first ~120 chars of reasoning.
 * Expanded:  shows the full reasoning in a subtle italic monologue style.
 *
 * Design language: APEX cyan accent, barely-there border, ghost background.
 * Signals intelligence — not noise.
 */

import { useState } from "react";

type Props = {
  thinking: string;
  compact?: boolean; // smaller padding for AERAPanel
};

export function ThinkingBubble({ thinking, compact = false }: Props) {
  const [open, setOpen] = useState(false);

  // First ~120 chars as a teaser when collapsed
  const preview = thinking.replace(/\s+/g, " ").slice(0, 120).trim();
  const truncated = thinking.length > 120;

  return (
    <div
      style={{
        marginBottom: compact ? 4 : 6,
        borderRadius: 10,
        border: "1px solid rgba(45,212,255,0.14)",
        background: "rgba(45,212,255,0.025)",
        overflow: "hidden",
      }}
    >
      {/* ── Header — always visible, click to expand/collapse ── */}
      <button
        onClick={() => setOpen((p) => !p)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: compact ? "6px 10px" : "7px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {/* Glowing cyan dot — signals "live intelligence" */}
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "var(--cyan)",
            opacity: 0.75,
            flexShrink: 0,
            boxShadow: "0 0 6px rgba(45,212,255,0.55)",
          }}
        />
        <span
          style={{
            fontSize: compact ? 9 : 10,
            fontWeight: 600,
            color: "var(--cyan)",
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            opacity: 0.8,
            flexShrink: 0,
          }}
        >
          AERA Reasoning
        </span>

        {/* Teaser text — only shown when collapsed */}
        {!open && (
          <span
            style={{
              fontSize: compact ? 10 : 10.5,
              color: "var(--text-5)",
              fontStyle: "italic",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            — {preview}{truncated ? "…" : ""}
          </span>
        )}

        {/* Chevron */}
        <span
          style={{
            fontSize: 10,
            color: "var(--text-6)",
            marginLeft: "auto",
            flexShrink: 0,
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "none",
            display: "inline-block",
          }}
        >
          ▾
        </span>
      </button>

      {/* ── Expanded reasoning content ── */}
      {open && (
        <div
          style={{
            padding: compact ? "3px 10px 8px 23px" : "4px 12px 10px 25px",
            fontSize: compact ? 11 : 12,
            lineHeight: 1.65,
            color: "var(--text-5)",
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            borderTop: "1px solid rgba(45,212,255,0.08)",
          }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
}
