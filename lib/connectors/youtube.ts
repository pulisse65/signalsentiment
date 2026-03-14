import { buildMockItems } from "@/lib/seed/mock-data";
import { SearchInput } from "@/lib/types/domain";
import { rangeToHours } from "@/lib/utils/time";
import { SourceConnector } from "./types";

export class YouTubeConnector implements SourceConnector {
  source = "youtube" as const;
  enabled = process.env.ENABLE_YOUTUBE_CONNECTOR !== "false";

  async collect(query: SearchInput) {
    if (!this.enabled) {
      return { source: this.source, items: [], healthy: false, message: "Connector disabled by configuration" };
    }

    // Integrate YouTube Data API v3 with key in server-side env in production.
    const items = buildMockItems(query.query, this.source, rangeToHours(query.timeRange));
    return { source: this.source, items, healthy: true, message: "Mock YouTube data loaded" };
  }
}
