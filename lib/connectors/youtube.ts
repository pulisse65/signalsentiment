import { buildMockItems } from "@/lib/seed/mock-data";
import { SearchInput } from "@/lib/types/domain";
import { rangeToHours } from "@/lib/utils/time";
import { ConnectorResult, SourceConnector } from "./types";

export class YouTubeConnector implements SourceConnector {
  source = "youtube" as const;
  enabled = process.env.ENABLE_YOUTUBE_CONNECTOR !== "false";

  async collect(query: SearchInput): Promise<ConnectorResult> {
    if (!this.enabled) {
      return {
        source: this.source,
        items: [],
        healthy: false,
        mode: "disabled" as const,
        message: "Connector disabled by configuration"
      };
    }

    // Integrate YouTube Data API v3 with key in server-side env in production.
    const items = buildMockItems(query.query, this.source, rangeToHours(query.timeRange));
    return {
      source: this.source,
      items,
      healthy: false,
      mode: "fallback" as const,
      message: "Mock YouTube data loaded"
    };
  }
}
