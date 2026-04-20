import { CompanyProfile, mapFeedItemToArticle, NewsArticle, NewsSourceAdapter, parseFeed, withinWindow } from "./base";

function renderUrl(template: string, symbol: string) {
  return template.replaceAll("{symbol}", encodeURIComponent(symbol.toLowerCase()));
}

function getFeedUrls(symbol: string) {
  const symbolTemplate = process.env.NEWS_SEEKING_ALPHA_SYMBOL_FEED_URL_TEMPLATE ?? "https://seekingalpha.com/api/sa/combined/{symbol}.xml";
  const fallbackFeed = process.env.NEWS_SEEKING_ALPHA_FALLBACK_FEED_URL ?? "https://seekingalpha.com/feed.xml";
  return [renderUrl(symbolTemplate, symbol), fallbackFeed].filter(Boolean);
}

export class SeekingAlphaNewsSource implements NewsSourceAdapter {
  source = "seeking_alpha" as const;
  enabled = process.env.NEWS_ENABLE_SEEKING_ALPHA !== "false";
  sourcePriority = Number(process.env.NEWS_SOURCE_PRIORITY_SEEKING_ALPHA ?? "4");

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
      throw new Error(`Seeking Alpha feeds unavailable: ${errors.slice(0, 2).join(" | ")}`);
    }

    return items;
  }
}
