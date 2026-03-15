import { buildMockItems } from "@/lib/seed/mock-data";
import { SearchInput } from "@/lib/types/domain";
import { rangeToHours } from "@/lib/utils/time";
import { ConnectorResult, SourceConnector } from "./types";

export class TikTokConnector implements SourceConnector {
  source = "tiktok" as const;
  enabled = process.env.ENABLE_TIKTOK_CONNECTOR !== "false";

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

    // TikTok official API access can be restricted by account/app approval.
    const items = buildMockItems(query.query, this.source, rangeToHours(query.timeRange));
    return {
      source: this.source,
      items,
      healthy: false,
      mode: "fallback" as const,
      message: "Mock TikTok data loaded (use official API when approved)"
    };
  }
}
