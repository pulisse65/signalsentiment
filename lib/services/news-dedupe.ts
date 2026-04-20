import { NewsArticle } from "@/lib/news-sources/base";
import { NewsRelevanceResult } from "@/lib/services/news-relevance";

export interface DedupedNewsArticle extends NewsArticle {
  relevanceScore: number;
  matchReasons: string[];
  mergedSources: string[];
}

function normalizedTitleTokens(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function titleSimilarity(a: string, b: string) {
  const setA = new Set(normalizedTitleTokens(a));
  const setB = new Set(normalizedTitleTokens(b));
  if (setA.size === 0 || setB.size === 0) return 0;

  let overlap = 0;
  setA.forEach((token) => {
    if (setB.has(token)) overlap += 1;
  });
  return overlap / Math.max(setA.size, setB.size);
}

function hoursBetween(a: string, b: string) {
  const diffMs = Math.abs(Date.parse(a) - Date.parse(b));
  return diffMs / 3600000;
}

function isRicher(candidate: DedupedNewsArticle, current: DedupedNewsArticle) {
  const candidateScore =
    (candidate.summary?.length ?? 0) +
    (candidate.author ? 40 : 0) +
    candidate.matchReasons.length * 8 +
    Math.round(candidate.relevanceScore * 100);
  const currentScore =
    (current.summary?.length ?? 0) +
    (current.author ? 40 : 0) +
    current.matchReasons.length * 8 +
    Math.round(current.relevanceScore * 100);
  return candidateScore > currentScore;
}

function mergeArticles(base: DedupedNewsArticle, duplicate: DedupedNewsArticle) {
  const preferred = isRicher(duplicate, base) ? duplicate : base;
  const secondary = preferred === base ? duplicate : base;
  return {
    ...preferred,
    tickerMatches: Array.from(new Set([...preferred.tickerMatches, ...secondary.tickerMatches])),
    companyMatches: Array.from(new Set([...preferred.companyMatches, ...secondary.companyMatches])),
    matchReasons: Array.from(new Set([...preferred.matchReasons, ...secondary.matchReasons])),
    mergedSources: Array.from(new Set([...preferred.mergedSources, ...secondary.mergedSources, secondary.source]))
  };
}

export function dedupeNewsArticles(entries: NewsRelevanceResult[]) {
  const deduped: DedupedNewsArticle[] = [];
  const byCanonicalUrl = new Map<string, number>();
  const byGuid = new Map<string, number>();

  const sorted = entries
    .map((entry) => ({
      ...entry.article,
      relevanceScore: entry.relevanceScore,
      matchReasons: entry.matchReasons,
      mergedSources: [entry.article.source]
    }))
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  for (const article of sorted) {
    const guidKey = article.guid ? article.guid.trim() : "";
    const urlKey = article.canonicalUrl;

    const guidMatchIndex = guidKey ? byGuid.get(guidKey) : undefined;
    const urlMatchIndex = byCanonicalUrl.get(urlKey);

    const existingIndex = guidMatchIndex ?? urlMatchIndex;
    if (existingIndex != null) {
      const merged = mergeArticles(deduped[existingIndex], article);
      deduped[existingIndex] = merged;
      byCanonicalUrl.set(merged.canonicalUrl, existingIndex);
      if (merged.guid) byGuid.set(merged.guid, existingIndex);
      continue;
    }

    const titleNearDuplicateIndex = deduped.findIndex(
      (existing) => titleSimilarity(existing.title, article.title) >= 0.88 && hoursBetween(existing.publishedAt, article.publishedAt) <= 6
    );

    if (titleNearDuplicateIndex >= 0) {
      const merged = mergeArticles(deduped[titleNearDuplicateIndex], article);
      deduped[titleNearDuplicateIndex] = merged;
      byCanonicalUrl.set(merged.canonicalUrl, titleNearDuplicateIndex);
      if (merged.guid) byGuid.set(merged.guid, titleNearDuplicateIndex);
      continue;
    }

    const index = deduped.length;
    deduped.push(article);
    byCanonicalUrl.set(article.canonicalUrl, index);
    if (guidKey) byGuid.set(guidKey, index);
  }

  return deduped;
}
