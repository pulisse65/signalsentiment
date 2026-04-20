import { buildMockItems } from "@/lib/seed/mock-data";
import { SearchInput, SourceItem } from "@/lib/types/domain";
import { rangeToHours } from "@/lib/utils/time";
import { ConnectorResult, SourceConnector } from "./types";

interface RedditChild {
  data: {
    id: string;
    title?: string;
    selftext?: string;
    permalink?: string;
    author?: string;
    created_utc?: number;
    num_comments?: number;
    score?: number;
    ups?: number;
    subreddit?: string;
  };
}

interface RedditListing {
  data?: {
    children?: RedditChild[];
  };
}

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "about",
  "into",
  "over",
  "just",
  "have",
  "what",
  "when",
  "where",
  "which",
  "will"
]);

const PROMO_TERMS = ["referral", "coupon", "promo", "discount", "code", "giveaway"];
const LOW_SIGNAL_PATTERNS = [
  "daily discussion",
  "what are your moves",
  "rate my portfolio",
  "weekend thread",
  "off topic",
  "general chat"
];

function timeRangeToRedditT(range: SearchInput["timeRange"]) {
  if (range === "24h") return "day";
  if (range === "7d") return "week";
  if (range === "30d") return "month";
  return "year";
}

function withinRange(createdUtc: number | undefined, hoursWindow: number) {
  if (!createdUtc) return false;
  const createdMs = createdUtc * 1000;
  return Date.now() - createdMs <= hoursWindow * 3600 * 1000;
}

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function tokenizeQuery(query: string) {
  return normalize(query)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

function scoreRelevance(post: RedditChild["data"], query: SearchInput) {
  const queryTokens = tokenizeQuery(query.query);
  const queryPhrase = normalize(query.query);

  const title = normalize(post.title ?? "");
  const body = normalize(post.selftext ?? "");
  const subreddit = normalize(post.subreddit ?? "");
  const combined = `${title} ${body} ${subreddit}`.trim();

  if (!combined) return 0;

  let score = 0;
  if (queryPhrase && title.includes(queryPhrase)) score += 0.55;
  if (queryPhrase && body.includes(queryPhrase)) score += 0.35;

  if (queryTokens.length > 0) {
    const matched = queryTokens.filter((token) => combined.includes(token)).length;
    score += (matched / queryTokens.length) * 0.5;
    if (matched === queryTokens.length) score += 0.2;
    if (queryTokens.some((token) => subreddit.includes(token))) score += 0.1;
  }

  const engagement = (post.num_comments ?? 0) + (post.score ?? post.ups ?? 0);
  score += Math.min(0.15, Math.log10(1 + Math.max(0, engagement)) / 10);

  const containsPromo = PROMO_TERMS.some((term) => combined.includes(term));
  const queryIsPromo = PROMO_TERMS.some((term) => queryPhrase.includes(term));
  if (containsPromo && !queryIsPromo) score -= 0.35;

  return score;
}

function extractCashtagOrSymbol(query: string) {
  const match = query.trim().toUpperCase().match(/\$?([A-Z]{1,6})$/);
  return match?.[1] ?? null;
}

function hasStrongQueryMatch(post: RedditChild["data"], query: SearchInput) {
  const queryTokens = tokenizeQuery(query.query);
  const phrase = normalize(query.query);
  const title = normalize(post.title ?? "");
  const body = normalize(post.selftext ?? "");
  const subreddit = normalize(post.subreddit ?? "");
  const combined = `${title} ${body} ${subreddit}`;

  if (phrase && (title.includes(phrase) || body.includes(phrase))) return true;

  const symbol = extractCashtagOrSymbol(query.query);
  if (symbol) {
    const symbolPattern = new RegExp(`(^|\\s)(\\$?${symbol.toLowerCase()})(\\s|$)`, "i");
    if (symbolPattern.test(`${post.title ?? ""} ${post.selftext ?? ""}`)) return true;
    if (subreddit.includes(symbol.toLowerCase())) return true;
  }

  if (queryTokens.length === 0) return false;

  const titleMatches = queryTokens.filter((token) => title.includes(token)).length;
  const totalMatches = queryTokens.filter((token) => combined.includes(token)).length;
  const minRequired = queryTokens.length === 1 ? 1 : Math.min(2, queryTokens.length);

  return totalMatches >= minRequired && titleMatches >= 1;
}

function isLowSignalThread(post: RedditChild["data"], query: SearchInput) {
  const title = normalize(post.title ?? "");
  if (!title) return true;

  const hasLowSignalPattern = LOW_SIGNAL_PATTERNS.some((pattern) => title.includes(pattern));
  if (!hasLowSignalPattern) return false;

  return !hasStrongQueryMatch(post, query);
}

function mapRedditPost(post: RedditChild["data"], query: SearchInput): SourceItem | null {
  if (!post.id) return null;

  const baseText = [post.title ?? "", post.selftext ?? ""].join(" ").trim();
  if (!baseText) return null;

  const publishedAt = post.created_utc ? new Date(post.created_utc * 1000).toISOString() : new Date().toISOString();
  const subredditPrefix = post.subreddit ? `[r/${post.subreddit}] ` : "";
  const relevance = scoreRelevance(post, query);

  return {
    source: "reddit",
    externalId: post.id,
    url: post.permalink ? `https://www.reddit.com${post.permalink}` : `https://www.reddit.com/comments/${post.id}`,
    author: post.author,
    title: `${subredditPrefix}${post.title ?? "Reddit discussion"}`,
    text: `${baseText}\n\nRelevance score: ${relevance.toFixed(2)}`,
    language: "en",
    publishedAt,
    engagement: {
      comments: post.num_comments ?? 0,
      upvotes: post.score ?? post.ups ?? 0,
      likes: 0,
      views: 0,
      shares: 0
    }
  };
}

async function fetchOAuthToken(clientId: string, clientSecret: string, userAgent: string) {
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Reddit OAuth token request failed (${response.status})`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Reddit OAuth response missing access_token");
  }

  return payload.access_token;
}

async function searchWithOAuth(query: SearchInput, token: string, userAgent: string) {
  const url = new URL("https://oauth.reddit.com/search.json");
  url.searchParams.set("q", query.query);
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", timeRangeToRedditT(query.timeRange));
  url.searchParams.set("limit", "100");
  url.searchParams.set("restrict_sr", "false");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": userAgent
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Reddit OAuth search failed (${response.status})`);
  }

  return (await response.json()) as RedditListing;
}

async function searchPublicFallback(query: SearchInput) {
  const url = new URL("https://www.reddit.com/search.json");
  url.searchParams.set("q", query.query);
  url.searchParams.set("sort", "new");
  url.searchParams.set("t", timeRangeToRedditT(query.timeRange));
  url.searchParams.set("limit", "100");
  url.searchParams.set("raw_json", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "SignalSentiment/1.0"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Reddit public search fallback failed (${response.status})`);
  }

  return (await response.json()) as RedditListing;
}

export class RedditConnector implements SourceConnector {
  source = "reddit" as const;
  enabled = process.env.ENABLE_REDDIT_CONNECTOR !== "false";

  async collect(query: SearchInput): Promise<ConnectorResult> {
    if (!this.enabled) {
      return {
        source: this.source,
        items: [],
        healthy: false,
        mode: "disabled",
        message: "Connector disabled by configuration"
      };
    }

    const hoursWindow = rangeToHours(query.timeRange);
    const relevanceThreshold = clampThreshold(Number(process.env.REDDIT_RELEVANCE_THRESHOLD ?? "0.68"));
    const clientId = process.env.REDDIT_CLIENT_ID;
    const clientSecret = process.env.REDDIT_CLIENT_SECRET;
    const userAgent = process.env.REDDIT_USER_AGENT ?? "SignalSentiment/1.0";

    try {
      let listing: RedditListing;
      let mode: "oauth" | "public" = "public";

      if (clientId && clientSecret) {
        const token = await fetchOAuthToken(clientId, clientSecret, userAgent);
        listing = await searchWithOAuth(query, token, userAgent);
        mode = "oauth";
      } else {
        listing = await searchPublicFallback(query);
      }

      const children = listing.data?.children ?? [];
      const ranked = children
        .map((child) => child.data)
        .filter((post) => withinRange(post.created_utc, hoursWindow))
        .filter((post) => !isLowSignalThread(post, query))
        .filter((post) => hasStrongQueryMatch(post, query))
        .map((post) => ({ post, relevance: scoreRelevance(post, query) }))
        .filter((entry) => entry.relevance >= relevanceThreshold)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 50);

      const items = ranked
        .map((entry) => mapRedditPost(entry.post, query))
        .filter((item): item is SourceItem => Boolean(item));

      if (items.length === 0) {
        return {
          source: this.source,
          items: [],
          healthy: true,
          mode: "live",
          message: `Reddit ${mode} search returned no strong matches at threshold ${relevanceThreshold}`
        };
      }

      return {
        source: this.source,
        items,
        healthy: true,
        mode: "live",
        message: `Reddit ${mode} ingestion returned ${items.length} high-relevance items`
      };
    } catch (error) {
      const fallback = buildMockItems(query.query, this.source, hoursWindow);
      return {
        source: this.source,
        items: fallback,
        healthy: false,
        mode: "fallback",
        error: error instanceof Error ? error.message : "Unknown Reddit connector error",
        message: "Reddit API unavailable; using mock fallback"
      };
    }
  }
}

function clampThreshold(value: number) {
  if (Number.isNaN(value)) return 0.68;
  return Math.min(0.95, Math.max(0.2, value));
}
