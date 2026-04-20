import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvestingNewsSource } from "@/lib/news-sources/investing";
import { MarketWatchNewsSource } from "@/lib/news-sources/marketwatch";
import { NasdaqNewsSource } from "@/lib/news-sources/nasdaq";
import { SeekingAlphaNewsSource } from "@/lib/news-sources/seeking-alpha";

const fixtureXml = fs.readFileSync(path.resolve(process.cwd(), "tests/fixtures/rss-sample.xml"), "utf8");

describe("RSS adapters", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(fixtureXml, { status: 200, headers: { "content-type": "application/xml" } }))
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("maps Nasdaq feed items", async () => {
    process.env.NEWS_ENABLE_NASDAQ = "true";
    const adapter = new NasdaqNewsSource();
    const items = await adapter.fetchForSymbol("TSLA", undefined, 24 * 365);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.source === "nasdaq")).toBe(true);
    expect(items[0].guid).toBeTruthy();
  });

  it("maps Seeking Alpha feed items", async () => {
    process.env.NEWS_ENABLE_SEEKING_ALPHA = "true";
    const adapter = new SeekingAlphaNewsSource();
    const items = await adapter.fetchForSymbol("TSLA", undefined, 24 * 365);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.source === "seeking_alpha")).toBe(true);
  });

  it("maps Investing feed items", async () => {
    process.env.NEWS_ENABLE_INVESTING = "true";
    const adapter = new InvestingNewsSource();
    const items = await adapter.fetchForSymbol("TSLA", undefined, 24 * 365);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.source === "investing")).toBe(true);
  });

  it("maps MarketWatch feed items when enabled", async () => {
    process.env.NEWS_ENABLE_MARKETWATCH = "true";
    const adapter = new MarketWatchNewsSource();
    const items = await adapter.fetchForSymbol("TSLA", undefined, 24 * 365);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item) => item.source === "marketwatch")).toBe(true);
  });
});
