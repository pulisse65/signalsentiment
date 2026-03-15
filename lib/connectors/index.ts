import { SearchInput, SourceName } from "@/lib/types/domain";
import { FacebookConnector } from "./facebook";
import { OpenRouterConnector } from "./openrouter";
import { RedditConnector } from "./reddit";
import { TikTokConnector } from "./tiktok";
import { ConnectorResult, SourceConnector } from "./types";
import { YouTubeConnector } from "./youtube";

const connectorMap: Record<SourceName, SourceConnector> = {
  reddit: new RedditConnector(),
  openrouter: new OpenRouterConnector(),
  youtube: new YouTubeConnector(),
  tiktok: new TikTokConnector(),
  facebook: new FacebookConnector()
};

export function getConnectors(sources: SourceName[]) {
  return sources.map((source) => connectorMap[source]);
}

export async function collectSourceData(query: SearchInput): Promise<ConnectorResult[]> {
  const connectors = getConnectors(query.selectedSources);
  const results = await Promise.all(
    connectors.map(async (connector) => {
      try {
        return await connector.collect(query);
      } catch (error) {
        return {
          source: connector.source,
          items: [],
          healthy: false,
          mode: "fallback" as const,
          error: error instanceof Error ? error.message : "Unknown connector error"
        };
      }
    })
  );
  return results;
}
