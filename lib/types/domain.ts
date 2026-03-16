export type SourceName = "reddit" | "youtube" | "tiktok" | "facebook" | "openrouter";
export type EntityCategory = "stock" | "sports" | "product" | "auto";
export type TrendDirection = "up" | "down" | "flat";

export interface SearchInput {
  query: string;
  category: EntityCategory;
  timeRange: "24h" | "7d" | "30d" | "90d";
  language?: string;
  selectedSources: SourceName[];
  minMentions: number;
}

export interface EntityResolution {
  canonicalName: string;
  category: Exclude<EntityCategory, "auto">;
  confidence: number;
  aliases: string[];
  disambiguationRequired: boolean;
  candidates?: string[];
}

export interface SourceItem {
  source: SourceName;
  externalId: string;
  url: string;
  author?: string;
  title?: string;
  text: string;
  language: string;
  publishedAt: string;
  engagement: {
    likes?: number;
    comments?: number;
    views?: number;
    shares?: number;
    upvotes?: number;
  };
}

export interface NormalizedItem extends SourceItem {
  normalizedText: string;
  dedupeHash: string;
  ageHours: number;
}

export interface SentimentBreakdown {
  positivePct: number;
  neutralPct: number;
  negativePct: number;
}

export interface SourceBreakdown {
  source: SourceName;
  sentimentScore: number;
  mentions: number;
  breakdown: SentimentBreakdown;
}

export interface TimePoint {
  timestamp: string;
  sentimentScore: number;
  mentions: number;
}

export interface ThemeSummary {
  theme: string;
  sentiment: "positive" | "negative";
  count: number;
}

export interface SentimentReport {
  reportId: string;
  entity: EntityResolution;
  query: SearchInput;
  generatedAt: string;
  overallScore: number;
  momentum: TrendDirection;
  confidence: number;
  mentionVolume: number;
  breakdown: SentimentBreakdown;
  sourceBreakdown: SourceBreakdown[];
  timeseries: TimePoint[];
  topPositiveThemes: ThemeSummary[];
  topNegativeThemes: ThemeSummary[];
  risingKeywords: string[];
  representativeItems: SourceItem[];
  anomalies: string[];
  qualityNotes: string[];
}

export interface ConnectorStatus {
  source: SourceName;
  enabled: boolean;
  healthy: boolean;
  lastRunAt?: string;
  message?: string;
}

export interface IngestionRun {
  id: string;
  query: string;
  source: SourceName;
  startedAt: string;
  endedAt?: string;
  status: "success" | "error";
  itemCount: number;
  errorMessage?: string;
}

export type RefreshJobState = "queued" | "running" | "completed" | "error";
export type RefreshStepState = "pending" | "running" | "completed" | "skipped" | "error";

export interface RefreshJobStep {
  source: SourceName;
  status: RefreshStepState;
  startedAt?: string;
  endedAt?: string;
  message?: string;
  error?: string;
  itemCount?: number;
}

export interface RefreshJobStatus {
  jobId: string;
  baseReportId: string;
  status: RefreshJobState;
  progressPct: number;
  startedAt: string;
  endedAt?: string;
  resultReportId?: string;
  error?: string;
  steps: RefreshJobStep[];
}
