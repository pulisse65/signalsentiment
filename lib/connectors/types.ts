import { SearchInput, SourceItem, SourceName } from "@/lib/types/domain";

export type ConnectorMode = "live" | "fallback" | "disabled";

export interface SourceConnector {
  source: SourceName;
  enabled: boolean;
  collect(query: SearchInput): Promise<ConnectorResult>;
}

export interface ConnectorResult {
  source: SourceName;
  items: SourceItem[];
  healthy: boolean;
  mode: ConnectorMode;
  message?: string;
  error?: string;
}
