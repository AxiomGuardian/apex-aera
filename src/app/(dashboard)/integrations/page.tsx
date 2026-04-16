"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Circle,
  RefreshCw,
  ExternalLink,
  Zap,
} from "lucide-react";
import type {
  SyncData,
  PlatformId,
  ConnectionStatus,
} from "@/lib/integrations/types";

// ─── Platform Config ───────────────────────────────────────────────────────────

const PLATFORMS: {
  id: PlatformId;
  label: string;
  description: string;
  connectUrl: string;
  docsUrl: string;
  envVars: string[];
  color: string;
  logoPath?: string;
}[] = [
  {
    id: "meta",
    label: "Meta Ads",
    description: "Facebook & Instagram campaigns — ROAS, spend, audience insights, conversion data.",
    connectUrl: "https://business.facebook.com/overview",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis",
    envVars: ["META_ADS_ACCESS_TOKEN", "META_ADS_ACCOUNT_ID"],
    color: "#2463EB",
  },
  {
    id: "google",
    label: "Google Ads",
    description: "Search, Display, Shopping & Performance Max — bid efficiency, ROAS, keyword data.",
    connectUrl: "https://ads.google.com",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    envVars: [
      "GOOGLE_ADS_CLIENT_ID",
      "GOOGLE_ADS_CLIENT_SECRET",
      "GOOGLE_ADS_REFRESH_TOKEN",
      "GOOGLE_ADS_CUSTOMER_ID",
      "GOOGLE_ADS_DEVELOPER_TOKEN",
    ],
    color: "#EA4335",
  },
  {
    id: "youtube",
    label: "YouTube Ads",
    description: "Video campaign performance, view-through rates, watch time, and conversion data.",
    connectUrl: "https://studio.youtube.com",
    docsUrl: "https://developers.google.com/youtube/analytics",
    envVars: ["YOUTUBE_CHANNEL_ID"], // shares Google OAuth creds
    color: "#FF0000",
  },
  {
    id: "linkedin",
    label: "LinkedIn Ads",
    description: "Sponsored content, InMail, and Lead Gen Forms — B2B conversion & audience data.",
    connectUrl: "https://www.linkedin.com/campaignmanager",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing",
    envVars: [
      "LINKEDIN_CLIENT_ID",
      "LINKEDIN_CLIENT_SECRET",
      "LINKEDIN_REFRESH_TOKEN",
      "LINKEDIN_AD_ACCOUNT_ID",
    ],
    color: "#0A66C2",
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#22c55e" }}>
          Connected
        </span>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5" style={{ color: "#f87171" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#f87171" }}>
          Error
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Circle className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.20)" }} />
      <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.35)" }}>
        Not connected
      </span>
    </span>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-3 py-2 rounded-[8px]"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <span className="text-[9px] font-semibold tracking-[0.08em] uppercase" style={{ color: "rgba(255,255,255,0.30)" }}>
        {label}
      </span>
      <span className="text-[14px] font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
        {value}
      </span>
    </div>
  );
}

function fmt(n: number, prefix = "$"): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${prefix}${(n / 1_000).toFixed(1)}K`;
  return `${prefix}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function fmtRoas(n: number): string {
  if (n === 0) return "—";
  return `${n.toFixed(2)}x`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [syncData, setSyncData] = useState<SyncData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const fetchSync = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/integrations/sync");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setSyncData(json.data as SyncData);
        setLastSynced(new Date().toLocaleTimeString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integration data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSync();
  }, [fetchSync]);

  // Determine per-platform status from sync data
  function getStatus(id: PlatformId): ConnectionStatus {
    if (!syncData) return "not_configured";
    const platforms = syncData.platforms;
    const platformData = platforms[id];
    if (!platformData) return "not_configured";
    return platformData.status;
  }

  function getMetrics(id: PlatformId): {
    spend: number; roas: number; conversions: number; impressions: number;
  } | null {
    if (!syncData) return null;
    const platforms = syncData.platforms;
    const d = platforms[id];
    if (!d || d.status !== "connected") return null;
    return {
      spend: d.totalSpend,
      roas: d.totalRoas,
      conversions: d.totalConversions,
      impressions: d.totalImpressions,
    };
  }

  const agg = syncData?.aggregate;

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: "var(--bg)" }}
    >
      <div className="max-w-[920px] mx-auto px-8 py-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Platform Connections
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.40)" }}>
              Connect your ad accounts to give Marcus live performance data.
              {lastSynced && (
                <span className="ml-2" style={{ color: "rgba(255,255,255,0.25)" }}>
                  Last synced {lastSynced}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => fetchSync(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-[9px] text-[12px] font-semibold transition-all duration-200"
            style={{
              border: "1px solid rgba(255,255,255,0.10)",
              color: "rgba(255,255,255,0.55)",
              background: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(45,212,255,0.25)";
              e.currentTarget.style.color = "rgba(45,212,255,0.9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)";
              e.currentTarget.style.color = "rgba(255,255,255,0.55)";
            }}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              strokeWidth={2}
            />
            Refresh
          </button>
        </div>

        {/* ── Aggregate Banner (when any platform is connected) ── */}
        {!loading && agg && agg.activePlatforms.length > 0 && (
          <div
            className="rounded-[14px] p-5 mb-8 flex items-center gap-6 flex-wrap"
            style={{
              background: "rgba(45,212,255,0.05)",
              border: "1px solid rgba(45,212,255,0.15)",
            }}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "#2DD4FF" }} />
              <span className="text-[12px] font-semibold tracking-wide uppercase" style={{ color: "#2DD4FF" }}>
                Live · {agg.activePlatforms.length} platform{agg.activePlatforms.length > 1 ? "s" : ""} connected
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap ml-auto">
              <MetricPill label="Total Spend" value={fmt(agg.totalSpend)} />
              <MetricPill label="Blended ROAS" value={fmtRoas(agg.totalRoas)} />
              <MetricPill label="Conversions" value={agg.totalConversions > 0 ? String(agg.totalConversions) : "—"} />
              <MetricPill label="Impressions" value={agg.totalImpressions >= 1000 ? `${(agg.totalImpressions / 1000).toFixed(1)}K` : (agg.totalImpressions > 0 ? String(agg.totalImpressions) : "—")} />
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {error && (
          <div
            className="rounded-[12px] px-4 py-3 mb-6 flex items-center gap-3"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.20)" }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#f87171" }} />
            <p className="text-[12px]" style={{ color: "rgba(248,113,113,0.85)" }}>
              Failed to load integration data: {error}
            </p>
          </div>
        )}

        {/* ── Platform Cards ── */}
        <div className="flex flex-col gap-4">
          {PLATFORMS.map((platform) => {
            const status = getStatus(platform.id);
            const metrics = getMetrics(platform.id);
            const isConnected = status === "connected";
            const hasError = status === "error";

            return (
              <div
                key={platform.id}
                className="rounded-[16px] p-6 transition-all duration-200"
                style={{
                  background: isConnected
                    ? "rgba(255,255,255,0.035)"
                    : "rgba(255,255,255,0.02)",
                  border: isConnected
                    ? `1px solid rgba(${hexToRgb(platform.color)}, 0.22)`
                    : hasError
                    ? "1px solid rgba(248,113,113,0.20)"
                    : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* Platform color dot */}
                    <div
                      className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{
                        background: `rgba(${hexToRgb(platform.color)}, 0.12)`,
                        border: `1px solid rgba(${hexToRgb(platform.color)}, 0.25)`,
                      }}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ background: platform.color, boxShadow: `0 0 8px ${platform.color}80` }}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="text-[15px] font-bold" style={{ color: "rgba(255,255,255,0.90)" }}>
                          {platform.label}
                        </span>
                        <StatusBadge status={status} />
                      </div>
                      <p className="text-[12px] mt-0.5 max-w-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                        {platform.description}
                      </p>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={platform.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-[7px] text-[11px] font-medium transition-all duration-150"
                      style={{
                        border: "1px solid rgba(255,255,255,0.08)",
                        color: "rgba(255,255,255,0.40)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)";
                        e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.color = "rgba(255,255,255,0.40)";
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Docs
                    </a>

                    <a
                      href={platform.connectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all duration-150"
                      style={{
                        background: isConnected
                          ? `rgba(${hexToRgb(platform.color)}, 0.15)`
                          : `rgba(${hexToRgb(platform.color)}, 0.10)`,
                        border: `1px solid rgba(${hexToRgb(platform.color)}, ${isConnected ? "0.35" : "0.20"})`,
                        color: platform.color,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = `rgba(${hexToRgb(platform.color)}, 0.22)`;
                        e.currentTarget.style.borderColor = `rgba(${hexToRgb(platform.color)}, 0.45)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isConnected
                          ? `rgba(${hexToRgb(platform.color)}, 0.15)`
                          : `rgba(${hexToRgb(platform.color)}, 0.10)`;
                        e.currentTarget.style.borderColor = `rgba(${hexToRgb(platform.color)}, ${isConnected ? "0.35" : "0.20"})`;
                      }}
                    >
                      {isConnected ? "Manage →" : "Connect →"}
                    </a>
                  </div>
                </div>

                {/* Live metrics (connected only) */}
                {isConnected && metrics && (
                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <MetricPill label="Spend (30d)" value={fmt(metrics.spend)} />
                    <MetricPill label="ROAS" value={fmtRoas(metrics.roas)} />
                    <MetricPill label="Conversions" value={metrics.conversions > 0 ? String(metrics.conversions) : "—"} />
                    <MetricPill
                      label="Impressions"
                      value={metrics.impressions >= 1000 ? `${(metrics.impressions / 1000).toFixed(1)}K` : (metrics.impressions > 0 ? String(metrics.impressions) : "—")}
                    />
                  </div>
                )}

                {/* Env vars checklist (not connected) */}
                {!isConnected && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[11px] font-semibold mb-2 tracking-wide uppercase" style={{ color: "rgba(255,255,255,0.25)" }}>
                      Required environment variables
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {platform.envVars.map((v) => (
                        <code
                          key={v}
                          className="px-2 py-0.5 rounded-[5px] text-[10px] font-mono"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.45)",
                          }}
                        >
                          {v}
                        </code>
                      ))}
                    </div>
                    <p className="text-[11px] mt-2.5" style={{ color: "rgba(255,255,255,0.25)" }}>
                      Add these in{" "}
                      <a
                        href="https://vercel.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        style={{ color: "rgba(45,212,255,0.65)" }}
                      >
                        Vercel → Settings → Environment Variables
                      </a>{" "}
                      then redeploy.
                    </p>
                  </div>
                )}

                {/* Error message */}
                {hasError && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[12px]" style={{ color: "rgba(248,113,113,0.70)" }}>
                      Connection error — check that your credentials are valid and the access token hasn&apos;t expired.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Setup Guide ── */}
        <div
          className="mt-8 rounded-[14px] p-6"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h2 className="text-[14px] font-bold mb-3" style={{ color: "rgba(255,255,255,0.70)" }}>
            How Marcus uses your platform data
          </h2>
          <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
            When you chat with Marcus directly, AERA automatically pulls live campaign performance
            from all connected platforms and injects it into his context — so he can speak with
            real ROAS figures, live spend, and specific campaign names rather than hypotheticals.
            Data refreshes every 5 minutes. No platform connected? Marcus is still ready — he&apos;ll
            walk you through what to set up first.
          </p>
        </div>

      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
