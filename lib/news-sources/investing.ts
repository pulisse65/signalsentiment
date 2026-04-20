import { CompanyProfile, mapFeedItemToArticle, NewsArticle, NewsSourceAdapter, parseFeed, withinWindow } from "./base";

function getFeedUrls() {
  const configured =
    process.env.NEWS_INVESTING_FEED_URLS ?? "https://www.investing.com/rss/news_25.rss,https://www.investing.com/rss/news.rss";
  return configured
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export class InvestingNewsSource implements NewsSourceAdapter {
  source = "investing" as const;
  enabled = process.env.NEWS_ENABLE_INVESTING !== "false";
  sourcePriority = Number(process.env.NEWS_SOURCE_PRIORITY_INVESTING ?? "3");

  async fetchForSymbol(symbol: string, _companyProfile?: CompanyProfile, windowHours = 24 * 7): Promise<NewsArticle[]> {
    if (!this.enabled) return [];

    const urls = getFeedUrls();
    if (urls.length === 0) return [];

    const items: NewsArticle[] = [];
    const errors: string[] = [];

    for (const url of urls) {
      try {
        const feedItems = await parseFeed(url);
        feedItems
          .map((item) =>
            mapFeedItemToArticle({
              source: this.source,
              sourcePriority: this.sourcePriority,
              item,
              fallbackTicker: symbol.toUpperCase()
            })
          )
          .filter((article): article is NewsArticle => Boolean(article))
          .filter((article) => withinWindow(article.publishedAt, windowHours))
          .forEach((article) => items.push(article));
      } catch (error) {
        errors.push(`${url}: ${error instanceof Error ? error.message : "unknown error"}`);
      }
    }

    if (items.length === 0 && errors.length === urls.length) {
      throw new Error(`Investing feeds unavailable: ${errors.slice(0, 2).join(" | ")}`);
    }

    return items;
  }
}
