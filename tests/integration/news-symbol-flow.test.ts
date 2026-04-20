import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateReport } from "@/lib/pipeline/report";

const fixtureXml = fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/rss-sample.xml"), "utf8");

describe("news symbol flow integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixtureXml, { status: 200, headers: { "content-type": "application/xml" } }))
    );
    process.env.ENABLE_NEWS_CONNECTOR = "true";
    process.env.NEWS_ENABLE_NASDAQ = "true";
    process.env.NEWS_ENABLE_SEEKING_ALPHA = "false";
    process.env.NEWS_ENABLE_INVESTING = "false";
    process.env.NEWS_ENABLE_MARKETWATCH = "false";
    process.env.NEWS_RELEVANCE_MIN = "0.25";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("ingests RSS, filters relevance, dedupes, scores sentiment, and exposes news summary", async () => {
    const report = await generateReport({
      query: "TSLA",
      category: "stock",
      timeRange: "7d",
      language: "en",
      selectedSources: ["news"],
      minMentions: 0
    });

    const newsBreakdown = report.sourceBreakdown.find((entry) => entry.source === "news");
    expect(newsBreakdown).toBeTruthy();
    expect(newsBreakdown?.mentions).toBeGreaterThan(0);
    expect(report.newsSummary).toBeTruthy();
    expect(report.newsSummary?.articleCount).toBeGreaterThan(0);
    expect(report.newsSummary?.articles[0].matchReasons.length).toBeGreaterThan(0);
  });
});
