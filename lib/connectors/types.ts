import { SearchInput, SourceItem, SourceName } from "@/lib/types/domain";

export interface SourceConnector {
  source: SourceName;
  enabled: boolean;
  collect(query: SearchInput): Promise<ConnectorResult>;
}

export interface ConnectorResult {
  source: SourceName;
  items: SourceItem[];
  healthy: boolean;
  message?: string;
  error?: string;
}
