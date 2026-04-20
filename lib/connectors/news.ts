import { resolveEntity } from "@/lib/pipeline/entity-resolver";
import { CompanyProfile } from "@/lib/news-sources/base";
import { ingestNewsForSymbol } from "@/lib/services/news-ingestion";
import { SearchInput, SourceItem } from "@/lib/types/domain";
import { ConnectorResult, SourceConnector } from "./types";

function buildCompanyProfile(query: SearchInput, entity: ReturnType<typeof resolveEntity>): CompanyProfile {
  const aliasCandidates = [query.query, entity.canonicalName, ...entity.aliases].map((value) => value.trim()).filter(Boolean);
  const tickerCandidates = aliasCandidates
    .filter((value) => /^[A-Za-z]{1,5}(?:[.\-][A-Za-z])?$/.test(value))
    .map((value) => value.toUpperCase());

  return {
    canonicalName: entity.canonicalName,
    aliases: Array.from(new Set(aliasCandidates)),
    tickerCandidates: Array.from(new Set(tickerCandidates))
  };
}

function toSourceItem(article: Awaited<ReturnType<typeof ingestNewsForSymbol>>["articles"][number]): SourceItem {
  return {
    source: "news",
    externalId: article.fingerprint,
    url: article.url,
    author: article.author,
    title: article.title,
    text: article.summary,
    language: "en",
    publishedAt: article.publishedAt,
    engagement: {
      likes: Math.round(article.relevanceScore * 12),
      comments: Math.round(article.relevanceScore * 6),
      views: Math.round(article.sourcePriority * 40),
      shares: 0,
      upvotes: 0
    },
    metadata: {
      feedSource: article.source,
      sourcePriority: article.sourcePriority,
      summary: article.summary,
      canonicalUrl: article.canonicalUrl,
      guid: article.guid,
      fingerprint: article.fingerprint,
      tickerMatches: article.tickerMatches,
      companyMatches: article.companyMatches,
      relevanceScore: article.relevanceScore,
      matchReasons: article.matchReasons,
      mergedSources: article.mergedSources,
      rawSourceMetadata: article.rawSourceMetadata
    }
  };
}

export class NewsConnector implements SourceConnector {
  source = "news" as const;
  enabled = process.env.ENABLE_NEWS_CONNECTOR !== "false";

  async collect(query: SearchInput): Promise<ConnectorResult> {
    if (!this.enabled) {
      return {
        source: this.source,
        items: [],
        healthy: false,
        mode: "disabled",
        message: "Connector disabled by configuration"
      };
    }

    const entity = resolveEntity(query);
    if (entity.category !== "stock") {
      return {
        source: this.source,
        items: [],
        healthy: true,
        mode: "live",
        message: "RSS stock/news ingestion skipped for non-stock category"
      };
    }

    try {
      const result = await ingestNewsForSymbol({
        query: query.query,
        timeRange: query.timeRange,
        companyProfile: buildCompanyProfile(query, entity)
      });

      const items = result.articles.map(toSourceItem);
      const degradedMessage =
        result.sourceErrors.length > 0
          ? `degraded sources: ${result.sourceErrors.map((error) => `${error.source} (${error.message})`).join(" | ")}`
          : undefined;

      if (items.length === 0 && result.sourceErrors.length > 0) {
        return {
          source: this.source,
          items: [],
          healthy: false,
          mode: "fallback",
          message: degradedMessage ?? "All enabled news sources failed",
          error: degradedMessage
        };
      }

      if (items.length === 0) {
        return {
          source: this.source,
          items: [],
          healthy: true,
          mode: "live",
          message: "No relevant RSS news articles matched this ticker/company within the selected window"
        };
      }

      return {
        source: this.source,
        items,
        healthy: result.sourceErrors.length === 0,
        mode: result.sourceErrors.length === 0 ? "live" : "fallback",
        message:
          degradedMessage ??
          `Ingested ${items.length} deduped relevant articles from ${result.sourcesUsed.join(", ")} (${result.fetchedCount} fetched)`
      };
    } catch (error) {
      return {
        source: this.source,
        items: [],
        healthy: false,
        mode: "fallback",
        message: "News ingestion failed",
        error: error instanceof Error ? error.message : "Unknown news connector error"
      };
    }
  }
}
