import { describe, expect, it } from "vitest";
import { NewsArticle } from "@/lib/news-sources/base";
import { evaluateNewsRelevance, normalizeTickerSymbol } from "@/lib/services/news-relevance";

const baseArticle: NewsArticle = {
  source: "nasdaq",
  sourcePriority: 5,
  title: "TSLA rallies as Tesla demand rebounds",
  summary: "Investors on social and news channels discuss improving Tesla momentum.",
  url: "https://example.com/tsla",
  canonicalUrl: "https://example.com/tsla",
  publishedAt: new Date().toISOString(),
  tickerMatches: [],
  companyMatches: [],
  guid: "guid-1",
  fingerprint: "fp-1",
  rawSourceMetadata: {}
};

describe("news relevance scoring", () => {
  it("scores ticker and company matches as relevant", () => {
    const ticker = normalizeTickerSymbol("TSLA");
    const result = evaluateNewsRelevance(baseArticle, ticker.variants, {
      canonicalName: "Tesla",
      aliases: ["Tesla Inc"],
      tickerCandidates: ["TSLA"]
    });

    expect(result.relevanceScore).toBeGreaterThan(0.35);
    expect(result.matchReasons.some((reason) => reason.startsWith("ticker:"))).toBe(true);
    expect(result.article.tickerMatches).toContain("TSLA");
  });

  it("applies ambiguous ticker penalty when company context is missing", () => {
    const result = evaluateNewsRelevance(
      {
        ...baseArticle,
        title: "IT budgets rise across sectors",
        summary: "Enterprise teams discuss IT transformation this year."
      },
      normalizeTickerSymbol("IT").variants,
      {
        canonicalName: "Gartner",
        aliases: [],
        tickerCandidates: ["IT"]
      }
    );

    expect(result.matchReasons).toContain("penalty:ambiguous_ticker");
    expect(result.relevanceScore).toBeLessThan(0.6);
  });
});
