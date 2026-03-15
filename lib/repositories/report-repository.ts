import { ConnectorResult } from "@/lib/connectors/types";
import { NormalizedItem, SentimentReport } from "@/lib/types/domain";
import {
  ConnectorStatusRow,
  ExtractedTopicRow,
  IngestionRunRow,
  SearchInsert,
  SearchRow,
  SentimentResultRow,
  SourceItemRow,
  TimeseriesRow
} from "@/lib/types/db";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import {
  deleteMemoryReport,
  getMemoryConnectorStatus,
  getMemoryHistory,
  getMemoryIngestionRuns,
  getMemoryReport,
  saveMemoryReport
} from "./memory-store";
import { pickRepresentativeItems } from "@/lib/pipeline/representatives";

function safeJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

type SourceMode = "live" | "fallback" | "disabled";

function prefixMode(mode: SourceMode, message?: string | null) {
  return `[mode:${mode}]${message ? ` ${message}` : ""}`;
}

function extractMode(message: string | null | undefined, healthy: boolean): SourceMode {
  if (!message) return healthy ? "live" : "fallback";
  const match = message.match(/^\[mode:(live|fallback|disabled)\]/);
  if (match) return match[1] as SourceMode;
  return healthy ? "live" : "fallback";
}

function stripModePrefix(message: string | null | undefined) {
  if (!message) return undefined;
  return message.replace(/^\[mode:(live|fallback|disabled)\]\s?/, "") || undefined;
}

export async function saveReportArtifacts(
  report: SentimentReport,
  items: NormalizedItem[],
  connectors: ConnectorResult[],
  userId?: string
) {
  saveMemoryReport(report, items, connectors, userId);

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  const searchInsert: SearchInsert = {
    id: report.reportId,
    user_id: userId ?? null,
    query: report.query.query,
    category: report.entity.category,
    time_range: report.query.timeRange,
    selected_sources: report.query.selectedSources,
    language: report.query.language ?? "en",
    min_mentions: report.query.minMentions,
    entity_name: report.entity.canonicalName,
    entity_confidence: report.entity.confidence,
    metadata: safeJson({ disambiguationRequired: report.entity.disambiguationRequired, candidates: report.entity.candidates })
  };

  await supabase.from("searches").insert(searchInsert as never);

  const sentimentInsert: SentimentResultRow = {
    search_id: report.reportId,
    overall_score: report.overallScore,
    mention_volume: report.mentionVolume,
    confidence_score: report.confidence,
    momentum: report.momentum,
    positive_pct: report.breakdown.positivePct,
    neutral_pct: report.breakdown.neutralPct,
    negative_pct: report.breakdown.negativePct,
    source_breakdown: safeJson(report.sourceBreakdown),
    quality_notes: report.qualityNotes,
    anomalies: report.anomalies
  };

  await supabase.from("sentiment_results").insert(sentimentInsert as never);

  if (report.timeseries.length > 0) {
    const rows: TimeseriesRow[] = report.timeseries.map((point) => ({
      search_id: report.reportId,
      bucket_time: point.timestamp,
      sentiment_score: point.sentimentScore,
      mention_count: point.mentions
    }));
    await supabase.from("sentiment_timeseries").insert(rows as never);
  }

  if (items.length > 0) {
    const sourceRows: SourceItemRow[] = items.map((item) => ({
      search_id: report.reportId,
      source: item.source,
      external_id: item.externalId,
      url: item.url,
      author: item.author,
      title: item.title,
      content: item.text,
      normalized_content: item.normalizedText,
      published_at: item.publishedAt,
      language: item.language,
      engagement: safeJson(item.engagement)
    }));
    await supabase.from("source_items").insert(sourceRows as never);
  }

  if (report.topPositiveThemes.length + report.topNegativeThemes.length > 0) {
    const allThemes = [...report.topPositiveThemes, ...report.topNegativeThemes];
    const topicRows: ExtractedTopicRow[] = allThemes.map((topic) => ({
      search_id: report.reportId,
      theme: topic.theme,
      sentiment: topic.sentiment,
      frequency: topic.count
    }));
    await supabase.from("extracted_topics").insert(topicRows as never);
  }

  if (connectors.length > 0) {
    const runRows: Omit<IngestionRunRow, "id">[] = connectors.map((connector) => ({
      search_id: report.reportId,
      source: connector.source,
      started_at: report.generatedAt,
      ended_at: new Date().toISOString(),
      status: connector.healthy ? "success" : "error",
      item_count: connector.items.length,
      error_message:
        connector.error != null
          ? prefixMode(connector.mode, connector.error)
          : connector.mode !== "live"
            ? prefixMode(connector.mode, connector.message ?? "Connector not in live mode")
            : null
    }));

    await supabase.from("ingestion_runs").insert(runRows as never);

    const connectorRows: ConnectorStatusRow[] = connectors.map((connector) => ({
      source: connector.source,
      enabled: connector.mode !== "disabled",
      healthy: connector.healthy,
      last_run_at: new Date().toISOString(),
      message: prefixMode(connector.mode, connector.error ?? connector.message ?? null)
    }));

    await supabase.from("connector_status").upsert(connectorRows as never, { onConflict: "source" });
  }
}

export async function getReportById(reportId: string, userId?: string): Promise<SentimentReport | null> {
  const inMemory = getMemoryReport(reportId, userId);
  if (inMemory) return inMemory.report;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  let searchQuery = supabase.from("searches").select("*").eq("id", reportId);
  if (userId) {
    searchQuery = searchQuery.eq("user_id", userId);
  }
  const searchRes = await searchQuery.single();
  const resultRes = await supabase.from("sentiment_results").select("*").eq("search_id", reportId).single();
  const seriesRes = await supabase
    .from("sentiment_timeseries")
    .select("*")
    .eq("search_id", reportId)
    .order("bucket_time", { ascending: true });
  const topicsRes = await supabase
    .from("extracted_topics")
    .select("*")
    .eq("search_id", reportId)
    .order("frequency", { ascending: false });
  const sourceItemsRes = await supabase
    .from("source_items")
    .select("*")
    .eq("search_id", reportId)
    .order("published_at", { ascending: false })
    .limit(250);

  const search = searchRes.data as SearchRow | null;
  const result = resultRes.data as SentimentResultRow | null;
  const series = (seriesRes.data as TimeseriesRow[] | null) ?? [];
  const topics = (topicsRes.data as ExtractedTopicRow[] | null) ?? [];
  const sourceItems = (sourceItemsRes.data as SourceItemRow[] | null) ?? [];
  const representativeItems = pickRepresentativeItems(
    sourceItems.map((item) => ({
      source: item.source,
      externalId: item.external_id,
      url: item.url,
      author: item.author,
      title: item.title,
      text: item.content,
      language: item.language,
      publishedAt: item.published_at,
      engagement: item.engagement
    })),
    80
  );

  if (searchRes.error || resultRes.error || !search || !result) return null;

  return {
    reportId,
    generatedAt: search.created_at,
    query: {
      query: search.query,
      category: search.category,
      timeRange: search.time_range,
      selectedSources: search.selected_sources,
      language: search.language,
      minMentions: search.min_mentions
    },
    entity: {
      canonicalName: search.entity_name,
      category: search.category,
      confidence: search.entity_confidence,
      aliases: [search.query, search.entity_name],
      disambiguationRequired: Boolean(search.metadata?.disambiguationRequired),
      candidates: (search.metadata?.candidates as string[] | undefined) ?? undefined
    },
    overallScore: result.overall_score,
    mentionVolume: result.mention_volume,
    confidence: result.confidence_score,
    momentum: result.momentum,
    breakdown: {
      positivePct: result.positive_pct,
      neutralPct: result.neutral_pct,
      negativePct: result.negative_pct
    },
    sourceBreakdown: result.source_breakdown as SentimentReport["sourceBreakdown"],
    timeseries: series.map((point) => ({
      timestamp: point.bucket_time,
      sentimentScore: point.sentiment_score,
      mentions: point.mention_count
    })),
    topPositiveThemes: topics
      .filter((topic) => topic.sentiment === "positive")
      .map((topic) => ({ theme: topic.theme, sentiment: "positive" as const, count: topic.frequency })),
    topNegativeThemes: topics
      .filter((topic) => topic.sentiment === "negative")
      .map((topic) => ({ theme: topic.theme, sentiment: "negative" as const, count: topic.frequency })),
    risingKeywords: topics.slice(0, 8).map((topic) => topic.theme),
    representativeItems,
    anomalies: result.anomalies ?? [],
    qualityNotes: result.quality_notes ?? []
  };
}

export async function listReports(userId?: string) {
  const inMemory = getMemoryHistory(userId);
  if (inMemory.length > 0) return inMemory;

  const supabase = getSupabaseAdmin();
  if (!supabase) return [];

  let searchQuery = supabase.from("searches").select("id").order("created_at", { ascending: false }).limit(50);
  if (userId) {
    searchQuery = searchQuery.eq("user_id", userId);
  }
  const searches = await searchQuery;
  const records = (searches.data as Array<Pick<SearchRow, "id">> | null) ?? [];
  if (searches.error || records.length === 0) return [];

  const reports = await Promise.all(records.map((record) => getReportById(record.id, userId)));
  return reports.filter((item): item is SentimentReport => Boolean(item));
}

export async function getConnectorHealth() {
  const inMemory = getMemoryConnectorStatus();
  const supabase = getSupabaseAdmin();

  if (!supabase) return inMemory;

  const data = await supabase.from("connector_status").select("*").order("source", { ascending: true });
  const rows = (data.data as ConnectorStatusRow[] | null) ?? [];
  if (data.error || rows.length === 0) return inMemory;

  return rows.map((item) => ({
    source: item.source,
    enabled: item.enabled,
    healthy: item.healthy,
    mode: extractMode(item.message, item.healthy),
    message: stripModePrefix(item.message),
    lastRunAt: item.last_run_at ?? undefined
  }));
}

export async function listIngestionRuns() {
  const inMemory = getMemoryIngestionRuns();
  const supabase = getSupabaseAdmin();

  if (!supabase) return inMemory;

  const data = await supabase.from("ingestion_runs").select("*").order("started_at", { ascending: false }).limit(80);
  const rows = (data.data as IngestionRunRow[] | null) ?? [];
  if (data.error || rows.length === 0) return inMemory;

  const searches = await supabase.from("searches").select("id,query");
  const searchRows = (searches.data as Array<Pick<SearchRow, "id" | "query">> | null) ?? [];
  const searchMap = new Map(searchRows.map((search) => [search.id, search.query]));

  return rows.map((run) => ({
    id: run.id,
    query: searchMap.get(run.search_id) ?? "Unknown",
    source: run.source,
    startedAt: run.started_at,
    endedAt: run.ended_at ?? undefined,
    status: run.status,
    mode: extractMode(run.error_message, run.status === "success"),
    itemCount: run.item_count,
    errorMessage: stripModePrefix(run.error_message)
  }));
}

export async function deleteReportById(reportId: string, userId?: string) {
  const deletedFromMemory = deleteMemoryReport(reportId, userId);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return deletedFromMemory;
  }

  let existingQuery = supabase.from("searches").select("id").eq("id", reportId);
  if (userId) {
    existingQuery = existingQuery.eq("user_id", userId);
  }
  const existing = await existingQuery.maybeSingle();
  if (!existing.data) return deletedFromMemory;

  let query = supabase.from("searches").delete().eq("id", reportId);
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const response = await query;
  if (response.error) return deletedFromMemory;
  return true;
}
