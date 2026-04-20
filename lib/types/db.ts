export type SourceName = "reddit" | "youtube" | "tiktok" | "facebook" | "openrouter" | "news";
export type Category = "stock" | "sports" | "product";

export interface SearchRow {
  id: string;
  user_id: string | null;
  query: string;
  category: Category;
  time_range: "24h" | "7d" | "30d" | "90d";
  selected_sources: SourceName[];
  language: string;
  min_mentions: number;
  entity_name: string;
  entity_confidence: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SearchInsert {
  id: string;
  user_id?: string | null;
  query: string;
  category: Category;
  time_range: "24h" | "7d" | "30d" | "90d";
  selected_sources: SourceName[];
  language: string;
  min_mentions: number;
  entity_name: string;
  entity_confidence: number;
  metadata: Record<string, unknown>;
}

export interface SentimentResultRow {
  search_id: string;
  overall_score: number;
  mention_volume: number;
  confidence_score: number;
  momentum: "up" | "down" | "flat";
  positive_pct: number;
  neutral_pct: number;
  negative_pct: number;
  source_breakdown: unknown[];
  quality_notes: string[];
  anomalies: string[];
}

export interface TimeseriesRow {
  search_id: string;
  bucket_time: string;
  sentiment_score: number;
  mention_count: number;
}

export interface SourceItemRow {
  search_id: string;
  source: SourceName;
  external_id: string;
  url: string;
  author?: string;
  title?: string;
  content: string;
  normalized_content: string;
  published_at: string;
  language: string;
  engagement: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface ExtractedTopicRow {
  search_id: string;
  theme: string;
  sentiment: "positive" | "negative";
  frequency: number;
}

export interface IngestionRunRow {
  id: string;
  search_id: string;
  source: SourceName;
  started_at: string;
  ended_at: string | null;
  status: "success" | "error";
  item_count: number;
  error_message: string | null;
}

export interface ConnectorStatusRow {
  source: SourceName;
  enabled: boolean;
  healthy: boolean;
  last_run_at: string | null;
  message: string | null;
}

export interface NewsArticleRow {
  id: string;
  canonical_url: string;
  primary_source: string;
  guid: string | null;
  fingerprint: string;
  title: string;
  summary: string | null;
  author: string | null;
  published_at: string;
  source_priority: number;
  ticker_matches: string[];
  company_matches: string[];
  raw_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SearchNewsArticleRow {
  search_id: string;
  news_article_id: string;
  relevance_score: number;
  sentiment_score: number | null;
  match_reasons: string[];
  merged_sources: string[];
  created_at: string;
}
