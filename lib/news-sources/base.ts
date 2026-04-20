import crypto from "node:crypto";
import Parser from "rss-parser";

export type NewsSourceName = "nasdaq" | "seeking_alpha" | "investing" | "marketwatch";

export interface CompanyProfile {
  canonicalName: string;
  aliases: string[];
  tickerCandidates: string[];
}

export interface NewsArticle {
  source: NewsSourceName;
  sourcePriority: number;
  title: string;
  summary: string;
  url: string;
  canonicalUrl: string;
  publishedAt: string;
  author?: string;
  tickerMatches: string[];
  companyMatches: string[];
  guid?: string;
  fingerprint: string;
  rawSourceMetadata: Record<string, unknown>;
}

export interface NewsSourceAdapter {
  source: NewsSourceName;
  enabled: boolean;
  sourcePriority: number;
  fetchForSymbol(symbol: string, companyProfile?: CompanyProfile, windowHours?: number): Promise<NewsArticle[]>;
}

interface ParsedFeedItem {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  isoDate?: string;
  pubDate?: string;
  creator?: string;
  author?: string;
  guid?: string;
  id?: string;
  [key: string]: unknown;
}

const parser = new Parser<Record<string, unknown>, ParsedFeedItem>({
  customFields: {
    item: ["guid", "id", "author", "creator", "description"]
  }
});

function removeTrackingParams(url: URL) {
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "mod", "modid", "guccounter"].forEach((key) =>
    url.searchParams.delete(key)
  );
}

export function canonicalizeUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = "";
    removeTrackingParams(parsed);
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return rawUrl.trim();
  }
}

export function toIsoDate(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

function stripHtml(text: string) {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNewsFingerprint(source: NewsSourceName, url: string, title: string, publishedAt: string, guid?: string) {
  return crypto
    .createHash("sha1")
    .update([source, guid ?? "", canonicalizeUrl(url), title.trim().toLowerCase(), publishedAt].join("|"))
    .digest("hex");
}

export async function parseFeed(url: string): Promise<ParsedFeedItem[]> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": process.env.NEWS_USER_AGENT ?? "SentiNewsBot/1.0 (+https://senti.app)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`RSS fetch failed (${response.status})`);
  }

  const xml = await response.text();
  const parsed = await parser.parseString(xml);
  return parsed.items ?? [];
}

export function mapFeedItemToArticle(params: {
  source: NewsSourceName;
  sourcePriority: number;
  item: ParsedFeedItem;
  fallbackTicker?: string;
}): NewsArticle | null {
  const { source, sourcePriority, item, fallbackTicker } = params;
  const title = (item.title ?? "").trim();
  const link = (item.link ?? "").trim();
  if (!title || !link) return null;

  const summary = stripHtml((item.contentSnippet ?? item.content ?? "").toString()).slice(0, 1200);
  const publishedAt = toIsoDate(item.isoDate ?? item.pubDate) ?? new Date().toISOString();
  const canonicalUrl = canonicalizeUrl(link);
  const guid = typeof item.guid === "string" ? item.guid : typeof item.id === "string" ? item.id : undefined;
  const fallbackMatches = fallbackTicker ? [fallbackTicker] : [];

  return {
    source,
    sourcePriority,
    title,
    summary,
    url: link,
    canonicalUrl,
    publishedAt,
    author: (item.creator ?? item.author ?? undefined) as string | undefined,
    tickerMatches: fallbackMatches,
    companyMatches: [],
    guid,
    fingerprint: buildNewsFingerprint(source, canonicalUrl, title, publishedAt, guid),
    rawSourceMetadata: {
      guid,
      feedItem: {
        title: item.title,
        link: item.link,
        isoDate: item.isoDate,
        pubDate: item.pubDate
      }
    }
  };
}

export function withinWindow(isoDate: string, windowHours: number) {
  const ageMs = Date.now() - Date.parse(isoDate);
  if (Number.isNaN(ageMs)) return false;
  return ageMs <= windowHours * 3600 * 1000;
}
