"use client";

import { Check, X, Loader2 } from "lucide-react";
import type { Step } from "@/lib/aera/steps";

/**
 * What AERA actually did, in order, in plain words. Shows while she works and
 * stays with the answer afterwards, so a change is never a mystery.
 */
export function StepTrail({ steps, live = false }: { steps: Step[]; live?: boolean }) {
  if (!steps.length) return null;
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 4,
        padding: "8px 11px", borderRadius: 12,
        background: "var(--surface-2)", border: "1px dashed var(--border-mid)",
        maxWidth: "100%",
      }}
    >
      {steps.map((s, i) => (
        <div key={s.tool + i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: s.ok ? "var(--text-4)" : "var(--rose)" }}>
          {s.ok
            ? <Check style={{ width: 11, height: 11, color: "var(--green)", flexShrink: 0 }} strokeWidth={3} />
            : <X style={{ width: 11, height: 11, color: "var(--rose)", flexShrink: 0 }} strokeWidth={3} />}
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
          {typeof s.ms === "number" && s.ms > 400 && (
            <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--text-6)", fontFeatureSettings: '"tnum"', flexShrink: 0 }}>
              {(s.ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
      ))}
      {live && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--text-5)" }}>
          <Loader2 className="animate-spin" style={{ width: 11, height: 11, color: "var(--cyan)" }} />
          Working
        </div>
      )}
    </div>
  );
}
