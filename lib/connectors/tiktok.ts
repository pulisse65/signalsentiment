import { buildMockItems } from "@/lib/seed/mock-data";
import { SearchInput } from "@/lib/types/domain";
import { rangeToHours } from "@/lib/utils/time";
import { SourceConnector } from "./types";

export class TikTokConnector implements SourceConnector {
  source = "tiktok" as const;
  enabled = process.env.ENABLE_TIKTOK_CONNECTOR !== "false";

  async collect(query: SearchInput) {
    if (!this.enabled) {
      return { source: this.source, items: [], healthy: false, message: "Connector disabled by configuration" };
    }

    // TikTok official API access can be restricted by account/app approval.
    const items = buildMockItems(query.query, this.source, rangeToHours(query.timeRange));
    return {
      source: this.source,
      items,
      healthy: true,
      message: "Mock TikTok data loaded (use official API when approved)"
    };
  }
}
