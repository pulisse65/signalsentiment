import { buildMockItems } from "@/lib/seed/mock-data";
import { SearchInput } from "@/lib/types/domain";
import { rangeToHours } from "@/lib/utils/time";
import { SourceConnector } from "./types";

export class RedditConnector implements SourceConnector {
  source = "reddit" as const;
  enabled = process.env.ENABLE_REDDIT_CONNECTOR !== "false";

  async collect(query: SearchInput) {
    if (!this.enabled) {
      return { source: this.source, items: [], healthy: false, message: "Connector disabled by configuration" };
    }

    // MVP uses mock data. Replace with official Reddit API client calls.
    const items = buildMockItems(query.query, this.source, rangeToHours(query.timeRange));
    return { source: this.source, items, healthy: true, message: "Mock Reddit data loaded" };
  }
}
