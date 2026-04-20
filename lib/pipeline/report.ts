import crypto from "node:crypto";
import { collectSourceData, SourceCollectionStatusEvent } from "@/lib/connectors";
import { NewsSummary, SearchInput, SentimentReport } from "@/lib/types/domain";
import { dedupeContent, normalizeContent } from "./normalize";
import { buildReportInsights, scoreNormalizedText, scoreSentiment, sourceBreakdown } from "./sentiment";
import { resolveEntity } from "./entity-resolver";
import { saveReportArtifacts } from "@/lib/repositories/report-repository";
import { pickRepresentativeItems } from "./representatives";
import { ConnectorResult } from "@/lib/connectors/types";

interface GenerateReportOptions {
  onSourceStatus?: (event: SourceCollectionStatusEvent) => void;
}

export async function generateReport(query: SearchInput, userId?: string, options?: GenerateReportOptions): Promise<SentimentReport> {
  const entity = resolveEntity(query);
  const connectorResults = await collectSourceData(query, { onStatus: options?.onSourceStatus });
  const rawItems = connectorResults
    .flatMap((result) => result.items)
    .filter((item) => item.language === (query.language ?? "en"));
  const normalized = dedupeContent(normalizeContent(rawItems)).map((item) => {
    if (item.source !== "news") return item;
    const sentimentScore = Number((scoreNormalizedText(item.normalizedText) * 100).toFixed(2));
    return {
      ...item,
      metadata: {
        ...(item.metadata ?? {}),
        sentimentScore
      }
    };
  });
  const scored = scoreSentiment(normalized);
  const insights = buildReportInsights(normalized);
  const newsSummary = buildNewsSummary(normalized, connectorResults);

  const qualityNotes: string[] = [];
  if (entity.disambiguationRequired) {
    qualityNotes.push("Entity may be ambiguous. Consider selecting a specific category for higher precision.");
  }
  if (normalized.length < query.minMentions) {
    qualityNotes.push(`Mention count (${normalized.length}) is below your minimum threshold (${query.minMentions}).`);
  }
  connectorResults.forEach((result) => {
    if (result.mode !== "live") {
      qualityNotes.push(
        `${result.source} is running in ${result.mode} mode: ${result.error ?? result.message ?? "non-live source data"}`
      );
    } else if (!result.healthy || result.error) {
      qualityNotes.push(`${result.source} connector issue: ${result.error ?? result.message ?? "unavailable"}`);
    }
  });

  const report: SentimentReport = {
    reportId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    query,
    entity,
    overallScore: scored.overallScore,
    mentionVolume: normalized.length,
    confidence: Number((Math.min(0.95, 0.45 + normalized.length / 200) * entity.confidence).toFixed(2)),
    breakdown: scored.breakdown,
    sourceBreakdown: sourceBreakdown(normalized),
    representativeItems: pickRepresentativeItems(normalized, 80),
    qualityNotes,
    newsSummary,
    ...insights
  };

  await saveReportArtifacts(report, normalized, connectorResults, userId);
  return report;
}

function getArrayMetadata(item: { metadata?: Record<string, unknown> }, key: string) {
  const value = item.metadata?.[key];
  return Array.isArray(value) ? value.map((entry) => String(entry)) : [];
}

function getNumberMetadata(item: { metadata?: Record<string, unknown> }, key: string, fallback: number) {
  const value = item.metadata?.[key];
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

function getStringMetadata(item: { metadata?: Record<string, unknown> }, key: string, fallback = "") {
  const value = item.metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

function parseDegradedSources(message: string | undefined) {
  if (!message || !message.startsWith("degraded sources:")) return [];
  return message
    .replace("degraded sources:", "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = entry.match(/^([^ ]+)\s+\((.+)\)$/);
      if (!match) return { source: entry, message: "Degraded" };
      return { source: match[1], message: match[2] };
    });
}

function buildNewsSummary(normalized: ReturnType<typeof dedupeContent>, connectorResults: ConnectorResult[]): NewsSummary | undefined {
  const newsItems = normalized.filter((item) => item.source === "news");
  if (newsItems.length === 0) return undefined;

  const scored = scoreSentiment(newsItems);
  const degradedSources = connectorResults
    .filter((result) => result.source === "news")
    .flatMap((result) => parseDegradedSources(result.message));
  const articles = newsItems.map((item) => ({
    id: item.externalId,
    source: getStringMetadata(item, "feedSource", "unknown"),
    sourcePriority: getNumberMetadata(item, "sourcePriority", 1),
    title: item.title ?? "Untitled",
    summary: getStringMetadata(item, "summary", item.text),
    url: item.url,
    publishedAt: item.publishedAt,
    author: item.author,
    tickerMatches: getArrayMetadata(item, "tickerMatches"),
    companyMatches: getArrayMetadata(item, "companyMatches"),
    relevanceScore: getNumberMetadata(item, "relevanceScore", 0),
    sentimentScore: getNumberMetadata(item, "sentimentScore", 0),
    matchReasons: getArrayMetadata(item, "matchReasons"),
    mergedSources: getArrayMetadata(item, "mergedSources")
  }));
  const lastUpdated = articles
    .map((article) => article.publishedAt)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];

  return {
    aggregateSentiment: scored.overallScore,
    articleCount: articles.length,
    sourcesUsed: Array.from(new Set(articles.flatMap((article) => article.mergedSources.length > 0 ? article.mergedSources : [article.source]))),
    lastUpdated: lastUpdated ?? new Date().toISOString(),
    articles,
    degradedSources: degradedSources.length > 0 ? degradedSources : undefined
  };
}
