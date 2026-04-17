"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  AlertCircle,
  Circle,
  RefreshCw,
  ExternalLink,
  Zap,
  LogIn,
  LogOut,
  Loader2,
} from "lucide-react";
import type { SyncData, PlatformId, ConnectionStatus } from "@/lib/integrations/types";

// ─── Platform definitions ─────────────────────────────────────────────────────

const PLATFORMS: {
  id: PlatformId;
  label: string;
  description: string;
  connectPath: string;       // internal OAuth initiation route
  docsUrl: string;
  requiredEnvVars: string[]; // APEX dev credentials (set once by Isaac in Vercel)
  color: string;
  note?: string;
}[] = [
  {
    id: "meta",
    label: "Meta Ads",
    description: "Facebook & Instagram campaigns — ROAS, spend, audience insights, conversion data.",
    connectPath: "/api/integrations/connect/meta",
    docsUrl: "https://developers.facebook.com/docs/marketing-apis",
    requiredEnvVars: ["META_APP_ID", "META_APP_SECRET"],
    color: "#2463EB",
  },
  {
    id: "google",
    label: "Google Ads",
    description: "Search, Display, Shopping & Performance Max — bid efficiency, ROAS, keyword data.",
    connectPath: "/api/integrations/connect/google",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    requiredEnvVars: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
    color: "#EA4335",
  },
  {
    id: "youtube",
    label: "YouTube Ads",
    description: "Video campaign performance, view-through rates, watch time, and conversion data.",
    connectPath: "/api/integrations/connect/google", // shares Google OAuth
    docsUrl: "https://developers.google.com/youtube/analytics",
    requiredEnvVars: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET"],
    color: "#FF0000",
    note: "Connects via Google — no separate login needed once Google Ads is connected.",
  },
  {
    id: "linkedin",
    label: "LinkedIn Ads",
    description: "Sponsored content, InMail, and Lead Gen — B2B conversion & audience data.",
    connectPath: "/api/integrations/connect/linkedin",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing",
    requiredEnvVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    color: "#0A66C2",
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="flex items-center gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#22c55e" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#22c55e" }}>Connected</span>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5" style={{ color: "#f87171" }} />
        <span className="text-[11px] font-semibold" style={{ color: "#f87171" }}>Error</span>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Circle className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.20)" }} />
      <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.30)" }}>Not connected</span>
    </span>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-0.5 px-3 py-2 rounded-[8px]"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
    >
      <span className="text-[9px] font-semibold tracking-[0.08em] uppercase" style={{ color: "rgba(255,255,255,0.28)" }}>
        {label}
      </span>
      <span className="text-[14px] font-bold" style={{ color: "rgba(255,255,255,0.85)" }}>
        {value}
      </span>
    </div>
  );
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
}

function fmt(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000) return `$${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n/1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtRoas(n: number): string { return n === 0 ? "—" : `${n.toFixed(2)}x`; }
function fmtK(n: number): string    { return n === 0 ? "—" : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n); }

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: "success" | "error" }) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-4 py-3 rounded-[10px] z-50"
      style={{
        background: type === "success" ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)",
        border:     `1px solid ${type === "success" ? "rgba(34,197,94,0.30)" : "rgba(248,113,113,0.30)"}`,
        backdropFilter: "blur(12px)",
        color:      type === "success" ? "#4ade80" : "#f87171",
        fontSize:   13,
        fontWeight: 600,
      }}
    >
      {type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      {message}
    </div>
  );
}

const TOAST_MESSAGES: Record<string, { type: "success" | "error"; text: string }> = {
  connected_meta:        { type: "success", text: "Meta Ads connected successfully." },
  connected_google:      { type: "success", text: "Google Ads connected successfully." },
  connected_linkedin:    { type: "success", text: "LinkedIn Ads connected successfully." },
  error_meta_denied:     { type: "error",   text: "Meta connection cancelled." },
  error_meta_no_account: { type: "error",   text: "No Meta ad account found on this profile." },
  error_meta_token:      { type: "error",   text: "Meta authentication failed — try again." },
  error_google_denied:   { type: "error",   text: "Google connection cancelled." },
  error_google_token:    { type: "error",   text: "Google authentication failed — try again." },
  error_google_no_refresh: { type: "error", text: "Google didn't return a refresh token. Revoke access in Google settings and try again." },
  error_linkedin_denied: { type: "error",   text: "LinkedIn connection cancelled." },
  error_linkedin_token:  { type: "error",   text: "LinkedIn authentication failed — try again." },
  error_meta_not_configured:     { type: "error", text: "Meta app credentials are not set up yet. Contact APEX." },
  error_google_not_configured:   { type: "error", text: "Google app credentials are not set up yet. Contact APEX." },
  error_linkedin_not_configured: { type: "error", text: "LinkedIn app credentials are not set up yet. Contact APEX." },
};

// ─── Main Page ────────────────────────────────────────────────────────────────
// useSearchParams() requires a Suspense boundary in Next.js App Router.
// IntegrationsInner contains the actual UI; the default export wraps it.

function IntegrationsInner() {
  const searchParams  = useSearchParams();
  const [syncData,   setSyncData]   = useState<SyncData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [disconnecting, setDisconnecting] = useState<PlatformId | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Parse toast from query params (after OAuth redirect) ──────────────────
  useEffect(() => {
    const connected = searchParams.get("connected");
    const errCode   = searchParams.get("error");

    let key: string | null = null;
    if (connected) key = `connected_${connected}`;
    if (errCode)   key = `error_${errCode}`;

    if (key && TOAST_MESSAGES[key]) {
      const { type, text } = TOAST_MESSAGES[key];
      setToast({ message: text, type });
      toastTimer.current = setTimeout(() => setToast(null), 5000);
    }
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, [searchParams]);

  const fetchSync = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res  = await fetch("/api/integrations/sync");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) {
        setSyncData(json.data as SyncData);
        setLastSynced(new Date().toLocaleTimeString());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSync(); }, [fetchSync]);

  async function handleDisconnect(platformId: PlatformId) {
    setDisconnecting(platformId);
    try {
      const res = await fetch("/api/integrations/connect/disconnect", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ platform: platformId }),
      });
      if (!res.ok) throw new Error("Disconnect failed");
      await fetchSync(true);
      setToast({ message: `${platformId.charAt(0).toUpperCase() + platformId.slice(1)} disconnected.`, type: "success" });
      setTimeout(() => setToast(null), 4000);
    } catch {
      setToast({ message: "Failed to disconnect — try again.", type: "error" });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setDisconnecting(null);
    }
  }

  function getStatus(id: PlatformId): ConnectionStatus {
    if (!syncData) return "not_configured";
    return syncData.platforms[id]?.status ?? "not_configured";
  }

  function getMetrics(id: PlatformId) {
    if (!syncData) return null;
    const d = syncData.platforms[id];
    if (!d || d.status !== "connected") return null;
    return {
      spend:       d.totalSpend,
      roas:        d.totalRoas,
      conversions: d.totalConversions,
      impressions: d.totalImpressions,
    };
  }

  const agg = syncData?.aggregate;

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <div className="max-w-[900px] mx-auto px-8 py-10">

        {/* ── Header ── */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text)" }}>
              Platform Connections
            </h1>
            <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>
              Connect your ad accounts so Marcus can see live campaign performance.
              {lastSynced && (
                <span className="ml-2" style={{ color: "rgba(255,255,255,0.20)" }}>
                  Synced {lastSynced}
                </span>
              )}
            </p>
          </div>

          <button
            onClick={() => fetchSync(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-[9px] text-[12px] font-semibold transition-all duration-200"
            style={{ border: "1px solid rgba(255,255,255,0.10)", color: "rgba(255,255,255,0.45)", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(45,212,255,0.25)"; e.currentTarget.style.color = "#2DD4FF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.color = "rgba(255,255,255,0.45)"; }}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} strokeWidth={2} />
            Refresh
          </button>
        </div>

        {/* ── Aggregate Banner ── */}
        {!loading && agg && agg.activePlatforms.length > 0 && (
          <div
            className="rounded-[14px] p-5 mb-8 flex items-center gap-6 flex-wrap"
            style={{ background: "rgba(45,212,255,0.05)", border: "1px solid rgba(45,212,255,0.14)" }}
          >
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "#2DD4FF" }} />
              <span className="text-[12px] font-semibold tracking-wide uppercase" style={{ color: "#2DD4FF" }}>
                Live · {agg.activePlatforms.length} platform{agg.activePlatforms.length > 1 ? "s" : ""} connected
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap ml-auto">
              <MetricPill label="Total Spend"   value={fmt(agg.totalSpend)} />
              <MetricPill label="Blended ROAS"  value={fmtRoas(agg.totalRoas)} />
              <MetricPill label="Conversions"   value={fmtK(agg.totalConversions)} />
              <MetricPill label="Impressions"   value={fmtK(agg.totalImpressions)} />
            </div>
          </div>
        )}

        {/* ── Error state ── */}
        {error && (
          <div className="rounded-[12px] px-4 py-3 mb-6 flex items-center gap-3"
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.18)" }}>
            <AlertCircle className="h-4 w-4 shrink-0" style={{ color: "#f87171" }} />
            <p className="text-[12px]" style={{ color: "rgba(248,113,113,0.80)" }}>{error}</p>
          </div>
        )}

        {/* ── Platform Cards ── */}
        <div className="flex flex-col gap-4">
          {PLATFORMS.map((platform) => {
            const status      = getStatus(platform.id);
            const metrics     = getMetrics(platform.id);
            const isConnected = status === "connected";
            const isYouTube   = platform.id === "youtube";
            const googleConnected = getStatus("google") === "connected";

            return (
              <div
                key={platform.id}
                className="rounded-[16px] p-6 transition-all duration-200"
                style={{
                  background: isConnected ? "rgba(255,255,255,0.035)" : "rgba(255,255,255,0.02)",
                  border:     isConnected
                    ? `1px solid rgba(${hexToRgb(platform.color)}, 0.22)`
                    : status === "error"
                    ? "1px solid rgba(248,113,113,0.18)"
                    : "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {/* Color dot */}
                    <div
                      className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0"
                      style={{
                        background: `rgba(${hexToRgb(platform.color)}, 0.12)`,
                        border:     `1px solid rgba(${hexToRgb(platform.color)}, 0.22)`,
                      }}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ background: platform.color, boxShadow: `0 0 8px ${platform.color}80` }}
                      />
                    </div>

                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[15px] font-bold" style={{ color: "rgba(255,255,255,0.90)" }}>
                          {platform.label}
                        </span>
                        <StatusBadge status={status} />
                        {isYouTube && !googleConnected && (
                          <span className="text-[10px] px-2 py-0.5 rounded-[4px]"
                            style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.30)" }}>
                            Via Google
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] mt-0.5 max-w-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.32)" }}>
                        {platform.note ?? platform.description}
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
                      style={{ border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.60)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.35)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Docs
                    </a>

                    {/* YouTube doesn't have its own connect button — it uses Google */}
                    {!isYouTube && (
                      isConnected ? (
                        <button
                          onClick={() => handleDisconnect(platform.id)}
                          disabled={disconnecting === platform.id}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all duration-150"
                          style={{
                            background:  "rgba(248,113,113,0.08)",
                            border:      "1px solid rgba(248,113,113,0.20)",
                            color:       "#f87171",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.15)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(248,113,113,0.08)"; }}
                        >
                          {disconnecting === platform.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <LogOut className="h-3.5 w-3.5" />
                          }
                          Disconnect
                        </button>
                      ) : (
                        <a
                          href={platform.connectPath}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[7px] text-[12px] font-semibold transition-all duration-150"
                          style={{
                            background:  `rgba(${hexToRgb(platform.color)}, 0.10)`,
                            border:      `1px solid rgba(${hexToRgb(platform.color)}, 0.22)`,
                            color:       platform.color,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(${hexToRgb(platform.color)}, 0.20)`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(${hexToRgb(platform.color)}, 0.10)`; }}
                        >
                          <LogIn className="h-3.5 w-3.5" />
                          Connect
                        </a>
                      )
                    )}
                  </div>
                </div>

                {/* Live metrics — connected */}
                {isConnected && metrics && (
                  <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <MetricPill label="Spend (30d)"  value={fmt(metrics.spend)} />
                    <MetricPill label="ROAS"          value={fmtRoas(metrics.roas)} />
                    <MetricPill label="Conversions"   value={fmtK(metrics.conversions)} />
                    <MetricPill label="Impressions"   value={fmtK(metrics.impressions)} />
                  </div>
                )}

                {/* What happens when you connect — not connected */}
                {!isConnected && !isYouTube && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.22)" }}>
                      Clicking <strong style={{ color: "rgba(255,255,255,0.38)" }}>Connect</strong> opens {platform.label}&apos;s login screen — you sign in with your own account and grant APEX read access. No credentials are shared with APEX manually.
                    </p>
                  </div>
                )}

                {/* Error */}
                {status === "error" && (
                  <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    <p className="text-[12px]" style={{ color: "rgba(248,113,113,0.65)" }}>
                      Connection error — your access token may have expired. Disconnect and reconnect to refresh.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── How it works ── */}
        <div
          className="mt-8 rounded-[14px] p-6"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h2 className="text-[14px] font-bold mb-3" style={{ color: "rgba(255,255,255,0.65)" }}>
            How Marcus uses your data
          </h2>
          <p className="text-[12px] leading-relaxed" style={{ color: "rgba(255,255,255,0.32)" }}>
            When you chat with Marcus, AERA automatically pulls live campaign data from every connected
            platform and injects it into his context — so he can reference real ROAS figures, specific
            campaign names, and live spend rather than estimates. Data refreshes every 5 minutes.
            Your credentials are encrypted and stored only in your browser session; APEX never sees
            your platform passwords.
          </p>
        </div>

      </div>

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <div className="h-5 w-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: "rgba(45,212,255,0.4)", borderTopColor: "transparent" }} />
      </div>
    }>
      <IntegrationsInner />
    </Suspense>
  );
}
