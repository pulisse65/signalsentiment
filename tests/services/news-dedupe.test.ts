import { describe, expect, it } from "vitest";
import { dedupeNewsArticles } from "@/lib/services/news-dedupe";

describe("news dedupe", () => {
  it("merges URL/GUID duplicates across sources and preserves provenance", () => {
    const now = new Date().toISOString();
    const deduped = dedupeNewsArticles([
      {
        relevanceScore: 0.82,
        matchReasons: ["ticker:title:TSLA"],
        article: {
          source: "nasdaq",
          sourcePriority: 5,
          title: "TSLA rallies on delivery outlook",
          summary: "Tesla momentum improves.",
          url: "https://example.com/story?utm_source=rss",
          canonicalUrl: "https://example.com/story",
          publishedAt: now,
          author: "A",
          tickerMatches: ["TSLA"],
          companyMatches: ["TESLA"],
          guid: "same-guid",
          fingerprint: "fp-a",
          rawSourceMetadata: {}
        }
      },
      {
        relevanceScore: 0.76,
        matchReasons: ["company:title:TESLA"],
        article: {
          source: "investing",
          sourcePriority: 3,
          title: "TSLA rallies on delivery outlook",
          summary: "Tesla remains widely discussed.",
          url: "https://example.com/story",
          canonicalUrl: "https://example.com/story",
          publishedAt: now,
          author: "B",
          tickerMatches: ["TSLA"],
          companyMatches: ["TESLA"],
          guid: "same-guid",
          fingerprint: "fp-b",
          rawSourceMetadata: {}
        }
      }
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].mergedSources).toContain("nasdaq");
    expect(deduped[0].mergedSources).toContain("investing");
    expect(deduped[0].matchReasons.length).toBeGreaterThan(1);
  });
});
