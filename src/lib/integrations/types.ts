// ─── AERA Integration Types ───────────────────────────────────────────────────
// Shared data structures for all ad platform integrations (Meta, Google,
// YouTube, LinkedIn). Placeholder credentials are used until real keys are
// added via Vercel environment variables.

export type PlatformId = "meta" | "google" | "youtube" | "linkedin";

export type ConnectionStatus = "connected" | "not_configured" | "error";

export interface PlatformConnection {
  platform: PlatformId;
  status: ConnectionStatus;
  label: string;
  errorMessage?: string;
  lastSynced?: string; // ISO date string
}

// ─── Campaign / Ad Metrics ────────────────────────────────────────────────────

export interface CampaignData {
  id: string;
  name: string;
  status: "ACTIVE" | "PAUSED" | "COMPLETED" | "UNKNOWN";
  spend: number;         // USD
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;       // attributed revenue USD
  roas: number;          // revenue / spend
  ctr: number;           // clicks / impressions * 100
  cpc: number;           // spend / clicks
  cpm: number;           // spend / impressions * 1000
  startDate?: string;    // YYYY-MM-DD
  endDate?: string;
}

export interface AudienceInsight {
  segment: string;       // e.g. "25-34 Female", "Lookalike 1%"
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
}

// ─── Per-Platform Response Shapes ────────────────────────────────────────────

export interface MetaAdsData {
  platform: "meta";
  status: ConnectionStatus;
  accountId?: string;
  accountName?: string;
  campaigns: CampaignData[];
  audienceInsights: AudienceInsight[];
  totalSpend: number;
  totalRevenue: number;
  totalRoas: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  dateRange: string;     // e.g. "last_30d"
}

export interface GoogleAdsData {
  platform: "google";
  status: ConnectionStatus;
  customerId?: string;
  campaigns: CampaignData[];
  totalSpend: number;
  totalRevenue: number;
  totalRoas: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  dateRange: string;
}

export interface YouTubeData {
  platform: "youtube";
  status: ConnectionStatus;
  channelId?: string;
  channelName?: string;
  campaigns: CampaignData[];          // Video ad campaigns
  totalViews: number;
  totalWatchTime: number;             // minutes
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRoas: number;
  dateRange: string;
}

export interface LinkedInData {
  platform: "linkedin";
  status: ConnectionStatus;
  accountId?: string;
  accountName?: string;
  campaigns: CampaignData[];
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalRoas: number;
  dateRange: string;
}

// ─── Aggregated Sync Response ─────────────────────────────────────────────────

export interface SyncData {
  syncedAt: string;         // ISO date string
  platforms: {
    meta?: MetaAdsData;
    google?: GoogleAdsData;
    youtube?: YouTubeData;
    linkedin?: LinkedInData;
  };
  aggregate: {
    totalSpend: number;
    totalRevenue: number;
    totalRoas: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    activePlatforms: PlatformId[];
    notConfigured: PlatformId[];
  };
  /** Human-readable summary string for injecting into Marcus's system prompt */
  marcusSummary: string;
}

// ─── API Response Wrapper ─────────────────────────────────────────────────────

export interface IntegrationApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
