import { describe, expect, it } from "vitest";
import { NormalizedItem } from "@/lib/types/domain";
import { scoreSentiment } from "@/lib/pipeline/sentiment";

function buildNewsItem(params: Partial<NormalizedItem>): NormalizedItem {
  return {
    source: "news",
    externalId: "id",
    url: "https://example.com",
    title: "title",
    text: "text",
    normalizedText: "strong great bullish growth",
    dedupeHash: "hash",
    ageHours: 1,
    language: "en",
    publishedAt: new Date().toISOString(),
    engagement: { likes: 2, comments: 1, views: 10, shares: 0, upvotes: 0 },
    metadata: { sourcePriority: 5, relevanceScore: 0.9 },
    ...params
  };
}

describe("news weighting", () => {
  it("weights higher-priority and higher-relevance news more heavily", () => {
    process.env.NEWS_WEIGHT_SOURCE_PRIORITY = "0.8";
    process.env.NEWS_WEIGHT_RELEVANCE = "0.8";
    process.env.NEWS_WEIGHT_RECENCY = "0.1";

    const items: NormalizedItem[] = [
      buildNewsItem({
        externalId: "positive-high",
        normalizedText: "strong great bullish growth",
        metadata: { sourcePriority: 5, relevanceScore: 0.95 }
      }),
      buildNewsItem({
        externalId: "negative-low",
        normalizedText: "weak bad concerns bearish risk",
        metadata: { sourcePriority: 1, relevanceScore: 0.2 }
      })
    ];

    const scored = scoreSentiment(items);
    expect(scored.overallScore).toBeGreaterThan(0);
  });
});
