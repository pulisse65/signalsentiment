import { SearchInput, SourceName } from "@/lib/types/domain";
import { FacebookConnector } from "./facebook";
import { OpenRouterConnector } from "./openrouter";
import { RedditConnector } from "./reddit";
import { TikTokConnector } from "./tiktok";
import { ConnectorMode, ConnectorResult, SourceConnector } from "./types";
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

export interface SourceCollectionStatusEvent {
  source: SourceName;
  phase: "started" | "finished" | "failed";
  healthy?: boolean;
  mode?: ConnectorMode;
  message?: string;
  error?: string;
  itemCount?: number;
}

interface CollectSourceDataOptions {
  onStatus?: (event: SourceCollectionStatusEvent) => void;
}

export async function collectSourceData(query: SearchInput, options?: CollectSourceDataOptions): Promise<ConnectorResult[]> {
  const connectors = getConnectors(query.selectedSources);
  const results = await Promise.all(
    connectors.map(async (connector) => {
      options?.onStatus?.({ source: connector.source, phase: "started" });
      try {
        const result = await connector.collect(query);
        options?.onStatus?.({
          source: connector.source,
          phase: "finished",
          healthy: result.healthy,
          mode: result.mode,
          message: result.message,
          error: result.error,
          itemCount: result.items.length
        });
        return result;
      } catch (error) {
        const fallbackResult = {
          source: connector.source,
          items: [],
          healthy: false,
          mode: "fallback" as const,
          error: error instanceof Error ? error.message : "Unknown connector error"
        };
        options?.onStatus?.({
          source: connector.source,
          phase: "failed",
          healthy: false,
          mode: "fallback",
          error: fallbackResult.error,
          itemCount: 0
        });
        return fallbackResult;
      }
    })
  );
  return results;
}
