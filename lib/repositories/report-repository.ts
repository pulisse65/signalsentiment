import { ConnectorResult } from "@/lib/connectors/types";
import { NormalizedItem, SearchInput, SentimentReport, StockTrendSnapshot } from "@/lib/types/domain";
import {
  ConnectorStatusRow,
  ExtractedTopicRow,
  IngestionRunRow,
  NewsArticleRow,
  SearchNewsArticleRow,
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
import { dedupeContent, normalizeContent } from "@/lib/pipeline/normalize";
import { buildReportInsights } from "@/lib/pipeline/sentiment";

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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function querySignature(input: SearchInput) {
  const sourceKey = [...input.selectedSources].sort().join(",");
  return [input.query.trim().toLowerCase(), input.category, input.timeRange, input.language ?? "en", String(input.minMentions), sourceKey].join("|");
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function buildNewsSummaryFromItems(items: Array<{
  externalId: string;
  source: string;
  url: string;
  title?: string;
  text: string;
  publishedAt: string;
  author?: string;
  metadata?: Record<string, unknown>;
}>) {
  const newsItems = items.filter((item) => item.source === "news");
  if (newsItems.length === 0) return undefined;

  const articles = newsItems.map((item) => ({
    id: item.externalId,
    source: asString(item.metadata?.feedSource, "unknown"),
    sourcePriority: asNumber(item.metadata?.sourcePriority, 1),
    title: item.title ?? "Untitled",
    summary: asString(item.metadata?.summary, item.text),
    url: item.url,
    publishedAt: item.publishedAt,
    author: item.author,
    tickerMatches: asStringArray(item.metadata?.tickerMatches),
    companyMatches: asStringArray(item.metadata?.companyMatches),
    relevanceScore: asNumber(item.metadata?.relevanceScore, 0),
    sentimentScore: asNumber(item.metadata?.sentimentScore, 0),
    matchReasons: asStringArray(item.metadata?.matchReasons),
    mergedSources: asStringArray(item.metadata?.mergedSources)
  }));

  const aggregateSentiment =
    articles.reduce((sum, article) => sum + (article.sentimentScore ?? 0), 0) / Math.max(1, articles.length);
  const lastUpdated = articles
    .map((article) => article.publishedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    aggregateSentiment: Number(aggregateSentiment.toFixed(2)),
    articleCount: articles.length,
    sourcesUsed: Array.from(
      new Set(
        articles.flatMap((article) =>
          article.mergedSources.length > 0 ? article.mergedSources : [article.source]
        )
      )
    ),
    lastUpdated: lastUpdated ?? new Date().toISOString(),
    articles
  };
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
      engagement: safeJson(item.engagement),
      metadata: safeJson(item.metadata ?? {})
    }));
    await supabase.from("source_items").insert(sourceRows as never);
  }

  const newsItems = items.filter((item) => item.source === "news");
  if (newsItems.length > 0) {
    const summaryById = new Map((report.newsSummary?.articles ?? []).map((article) => [article.id, article]));
    const linkRows: Omit<SearchNewsArticleRow, "created_at">[] = [];

    for (const item of newsItems) {
      const metadata = item.metadata ?? {};
      const articleSummary = summaryById.get(item.externalId);
      const canonicalUrl = asString(metadata.canonicalUrl, item.url);
      const fingerprint = asString(metadata.fingerprint, item.dedupeHash);
      const guid = asString(metadata.guid, "");
      const articleRow: Omit<NewsArticleRow, "id" | "created_at" | "updated_at"> = {
        canonical_url: canonicalUrl,
        primary_source: asString(metadata.feedSource, "unknown"),
        guid: guid || null,
        fingerprint,
        title: item.title ?? "Untitled",
        summary: asString(metadata.summary, item.text) || null,
        author: item.author ?? null,
        published_at: item.publishedAt,
        source_priority: asNumber(metadata.sourcePriority, 1),
        ticker_matches: asStringArray(metadata.tickerMatches),
        company_matches: asStringArray(metadata.companyMatches),
        raw_metadata: safeJson(metadata)
      };

      const upserted = (await supabase
        .from("news_articles")
        .upsert(articleRow as never, { onConflict: "fingerprint" })
        .select("id")
        .single()) as { data?: { id?: string } | null };

      if (!upserted.data?.id) continue;
      linkRows.push({
        search_id: report.reportId,
        news_article_id: upserted.data.id,
        relevance_score: articleSummary?.relevanceScore ?? asNumber(metadata.relevanceScore, 0),
        sentiment_score: articleSummary?.sentimentScore ?? asNumber(metadata.sentimentScore, 0),
        match_reasons: articleSummary?.matchReasons ?? asStringArray(metadata.matchReasons),
        merged_sources: articleSummary?.mergedSources ?? asStringArray(metadata.mergedSources)
      });
    }

    if (linkRows.length > 0) {
      await supabase
        .from("search_news_articles")
        .upsert(linkRows as never, { onConflict: "search_id,news_article_id" });
    }
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
  const reconstructedItems = sourceItems.map((item) => ({
    source: item.source,
    externalId: item.external_id,
    url: item.url,
    author: item.author,
    title: item.title,
    text: item.content,
    language: item.language,
    publishedAt: item.published_at,
    engagement: item.engagement,
    metadata: item.metadata ?? {}
  }));
  const recomputedInsights =
    (series.length === 0 || topics.length === 0) && reconstructedItems.length > 0
      ? buildReportInsights(dedupeContent(normalizeContent(reconstructedItems)))
      : null;
  const representativeItems = pickRepresentativeItems(
    reconstructedItems,
    80
  );
  const newsSummary = buildNewsSummaryFromItems(reconstructedItems);

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
    momentum: recomputedInsights?.momentum ?? result.momentum,
    breakdown: {
      positivePct: result.positive_pct,
      neutralPct: result.neutral_pct,
      negativePct: result.negative_pct
    },
    sourceBreakdown: result.source_breakdown as SentimentReport["sourceBreakdown"],
    timeseries:
      recomputedInsights?.timeseries ??
      series.map((point) => ({
        timestamp: point.bucket_time,
        sentimentScore: point.sentiment_score,
        mentions: point.mention_count
      })),
    topPositiveThemes:
      recomputedInsights?.topPositiveThemes ??
      topics
        .filter((topic) => topic.sentiment === "positive")
        .map((topic) => ({ theme: topic.theme, sentiment: "positive" as const, count: topic.frequency })),
    topNegativeThemes:
      recomputedInsights?.topNegativeThemes ??
      topics
        .filter((topic) => topic.sentiment === "negative")
        .map((topic) => ({ theme: topic.theme, sentiment: "negative" as const, count: topic.frequency })),
    risingKeywords: recomputedInsights?.risingKeywords ?? topics.slice(0, 8).map((topic) => topic.theme),
    representativeItems,
    anomalies: recomputedInsights?.anomalies ?? result.anomalies ?? [],
    qualityNotes: result.quality_notes ?? [],
    newsSummary
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

export async function findPreviousComparableReport(current: SentimentReport, userId?: string) {
  const history = await listReports(userId);
  const currentTimestamp = Date.parse(current.generatedAt);
  const signature = querySignature(current.query);

  const candidates = history
    .filter((item) => item.reportId !== current.reportId)
    .filter((item) => querySignature(item.query) === signature)
    .filter((item) => item.entity.canonicalName === current.entity.canonicalName)
    .filter((item) => Date.parse(item.generatedAt) < currentTimestamp)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));

  return candidates[0] ?? null;
}

function calcSentimentMomentumScore(
  latest: SentimentReport,
  baseline: SentimentReport,
  mentionGrowthPct: number
) {
  const scoreDelta = latest.overallScore - baseline.overallScore;
  const trendBoost = latest.momentum === "up" ? 8 : latest.momentum === "down" ? -8 : 0;
  const raw = 50 + scoreDelta * 1.25 + mentionGrowthPct * 0.14 + trendBoost;
  return Number(clamp(raw, 0, 100).toFixed(1));
}

function calcDirection(scoreDelta: number, mentionGrowthPct: number): StockTrendSnapshot["direction"] {
  if (scoreDelta >= 5 || mentionGrowthPct >= 25) return "accelerating";
  if (scoreDelta <= -5 || mentionGrowthPct <= -25) return "cooling";
  return "stable";
}

export async function getStockTrendSnapshot(report: SentimentReport, userId?: string, windowDays = 30) {
  if (report.entity.category !== "stock") return null;
  const now = Date.parse(report.generatedAt);
  const windowStart = now - windowDays * 24 * 3600 * 1000;
  const history = await listReports(userId);
  const relevant = history
    .filter((item) => item.entity.category === "stock")
    .filter((item) => item.entity.canonicalName === report.entity.canonicalName)
    .filter((item) => Date.parse(item.generatedAt) >= windowStart && Date.parse(item.generatedAt) <= now)
    .sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));

  if (relevant.length === 0) return null;

  const baseline = relevant[0];
  const latest = report;
  const scoreDelta = Number((latest.overallScore - baseline.overallScore).toFixed(2));
  const mentionGrowthPct = Number(
    (((latest.mentionVolume - baseline.mentionVolume) / Math.max(1, baseline.mentionVolume)) * 100).toFixed(1)
  );
  const sentimentMomentumScore = calcSentimentMomentumScore(latest, baseline, mentionGrowthPct);

  return {
    symbol: report.entity.canonicalName,
    reportCount: relevant.length,
    windowStart: baseline.generatedAt,
    windowEnd: latest.generatedAt,
    latestScore: latest.overallScore,
    latestMentions: latest.mentionVolume,
    scoreDelta,
    mentionGrowthPct,
    sentimentMomentumScore,
    direction: calcDirection(scoreDelta, mentionGrowthPct)
  } satisfies StockTrendSnapshot;
}

export async function getTrendingStocks(userId?: string, windowDays = 30, limit = 12): Promise<StockTrendSnapshot[]> {
  const now = Date.now();
  const windowStart = now - windowDays * 24 * 3600 * 1000;
  const history = await listReports(userId);
  const stockReports = history
    .filter((item) => item.entity.category === "stock")
    .filter((item) => Date.parse(item.generatedAt) >= windowStart)
    .sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));

  const grouped = new Map<string, SentimentReport[]>();
  stockReports.forEach((item) => {
    grouped.set(item.entity.canonicalName, [...(grouped.get(item.entity.canonicalName) ?? []), item]);
  });

  const snapshots = Array.from(grouped.entries())
    .map(([symbol, reports]) => {
      const baseline = reports[0];
      const latest = reports[reports.length - 1];
      const hasHistory = reports.length >= 2;
      const scoreDelta = hasHistory ? Number((latest.overallScore - baseline.overallScore).toFixed(2)) : 0;
      const mentionGrowthPct = hasHistory
        ? Number((((latest.mentionVolume - baseline.mentionVolume) / Math.max(1, baseline.mentionVolume)) * 100).toFixed(1))
        : 0;
      return {
        symbol,
        reportCount: reports.length,
        windowStart: baseline.generatedAt,
        windowEnd: latest.generatedAt,
        latestScore: latest.overallScore,
        latestMentions: latest.mentionVolume,
        scoreDelta,
        mentionGrowthPct,
        sentimentMomentumScore: calcSentimentMomentumScore(latest, baseline, mentionGrowthPct),
        direction: calcDirection(scoreDelta, mentionGrowthPct)
      } satisfies StockTrendSnapshot;
    })
    .filter((item): item is StockTrendSnapshot => Boolean(item))
    .sort((a, b) => b.sentimentMomentumScore - a.sentimentMomentumScore || b.scoreDelta - a.scoreDelta);

  return snapshots.slice(0, limit);
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
