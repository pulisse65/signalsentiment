import { CompanyProfile, mapFeedItemToArticle, NewsArticle, NewsSourceAdapter, parseFeed, withinWindow } from "./base";

function renderUrl(template: string, symbol: string) {
  return template.replaceAll("{symbol}", encodeURIComponent(symbol.toUpperCase()));
}

function getFeedUrls(symbol: string) {
  const primaryTemplate = process.env.NEWS_NASDAQ_FEED_URL_TEMPLATE ?? "https://www.nasdaq.com/feed/rssoutbound?symbol={symbol}";
  const fallbackTemplate = process.env.NEWS_NASDAQ_FALLBACK_FEED_URL ?? "https://www.nasdaq.com/feed/rssoutbound?category=Business";

  return [renderUrl(primaryTemplate, symbol), fallbackTemplate].filter(Boolean);
}

export class NasdaqNewsSource implements NewsSourceAdapter {
  source = "nasdaq" as const;
  enabled = process.env.NEWS_ENABLE_NASDAQ !== "false";
  sourcePriority = Number(process.env.NEWS_SOURCE_PRIORITY_NASDAQ ?? "5");

  async fetchForSymbol(symbol: string, _companyProfile?: CompanyProfile, windowHours = 24 * 7): Promise<NewsArticle[]> {
    if (!this.enabled) return [];

    const urls = getFeedUrls(symbol);
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
      throw new Error(`Nasdaq feeds unavailable: ${errors.slice(0, 2).join(" | ")}`);
    }

    return items;
  }
}
