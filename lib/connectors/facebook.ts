import { buildMockItems } from "@/lib/seed/mock-data";
import { SearchInput, SourceItem } from "@/lib/types/domain";
import { rangeToHours } from "@/lib/utils/time";
import { ConnectorResult, SourceConnector } from "./types";

interface GraphPage {
  id: string;
  name: string;
  link?: string;
}

interface GraphPagePost {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  from?: { name?: string };
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

interface GraphResponse<T> {
  data?: T[];
  error?: { message?: string; code?: number; type?: string };
}

const GRAPH_BASE_URL = process.env.FACEBOOK_GRAPH_BASE_URL ?? "https://graph.facebook.com/v21.0";

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

function isRecentEnough(isoDate: string | undefined, hoursWindow: number) {
  if (!isoDate) return false;
  const publishedMs = Date.parse(isoDate);
  if (Number.isNaN(publishedMs)) return false;
  return Date.now() - publishedMs <= hoursWindow * 3600 * 1000;
}

function mapPostToSourceItem(post: GraphPagePost, query: string): SourceItem | null {
  if (!post.id || !post.message || !post.created_time) return null;

  return {
    source: "facebook",
    externalId: post.id,
    url: post.permalink_url ?? `https://www.facebook.com/${post.id}`,
    author: post.from?.name ?? "unknown",
    title: `${query} discussion`,
    text: post.message,
    language: "en",
    publishedAt: post.created_time,
    engagement: {
      likes: post.likes?.summary?.total_count ?? 0,
      comments: post.comments?.summary?.total_count ?? 0,
      shares: post.shares?.count ?? 0,
      views: 0,
      upvotes: 0
    }
  };
}

async function fetchJson<T>(url: URL) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store"
  });

  const payload = (await response.json()) as GraphResponse<T>;

  if (!response.ok || payload.error) {
    const message = payload.error?.message ?? `Graph API request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export class FacebookConnector implements SourceConnector {
  source = "facebook" as const;
  enabled = process.env.ENABLE_FACEBOOK_CONNECTOR !== "false";

  async collect(query: SearchInput): Promise<ConnectorResult> {
    if (!this.enabled) {
      return { source: this.source, items: [], healthy: false, mode: "disabled", message: "Connector disabled by configuration" };
    }

    const token = process.env.FACEBOOK_ACCESS_TOKEN;
    if (!token) {
      const fallback = buildMockItems(query.query, this.source, rangeToHours(query.timeRange));
      return {
        source: this.source,
        items: fallback,
        healthy: false,
        mode: "fallback",
        message: "Missing FACEBOOK_ACCESS_TOKEN; using mock fallback"
      };
    }

    const hoursWindow = rangeToHours(query.timeRange);

    try {
      const pagesUrl = buildUrl("/search", {
        type: "page",
        q: query.query,
        fields: "id,name,link",
        limit: "5",
        access_token: token
      });

      const pageRes = await fetchJson<GraphPage>(pagesUrl);
      const pages = pageRes.data ?? [];

      if (pages.length === 0) {
        return {
          source: this.source,
          items: [],
          healthy: true,
          mode: "live",
          message: "No matching Facebook pages for this query"
        };
      }

      const postResults = await Promise.all(
        pages.map(async (page) => {
          const postsUrl = buildUrl(`/${page.id}/posts`, {
            fields:
              "id,message,created_time,permalink_url,from,likes.summary(true),comments.summary(true),shares",
            limit: "15",
            access_token: token
          });

          try {
            const posts = await fetchJson<GraphPagePost>(postsUrl);
            return posts.data ?? [];
          } catch {
            return [] as GraphPagePost[];
          }
        })
      );

      const items = postResults
        .flat()
        .filter((post) => isRecentEnough(post.created_time, hoursWindow))
        .map((post) => mapPostToSourceItem(post, query.query))
        .filter((item): item is SourceItem => Boolean(item));

      if (items.length === 0) {
        const fallback = buildMockItems(query.query, this.source, hoursWindow);
        return {
          source: this.source,
          items: fallback,
          healthy: false,
          mode: "fallback",
          message:
            "Facebook Graph API returned no accessible recent post data (permissions/restrictions likely); using mock fallback"
        };
      }

      return {
        source: this.source,
        items,
        healthy: true,
        mode: "live",
        message: `Facebook Graph API ingested ${items.length} items`
      };
    } catch (error) {
      const fallback = buildMockItems(query.query, this.source, hoursWindow);
      return {
        source: this.source,
        items: fallback,
        healthy: false,
        mode: "fallback",
        error: error instanceof Error ? error.message : "Unknown Facebook connector error",
        message: "Using mock fallback because Facebook API request failed"
      };
    }
  }
}
