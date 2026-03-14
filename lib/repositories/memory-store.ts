import { ConnectorResult } from "@/lib/connectors/types";
import { NormalizedItem, SentimentReport } from "@/lib/types/domain";

interface StoredReport {
  report: SentimentReport;
  items: NormalizedItem[];
  connectors: ConnectorResult[];
  userId?: string;
}

export const memoryStore = {
  reports: new Map<string, StoredReport>()
};

export function saveMemoryReport(
  report: SentimentReport,
  items: NormalizedItem[],
  connectors: ConnectorResult[],
  userId?: string
) {
  memoryStore.reports.set(report.reportId, { report, items, connectors, userId });
}

export function getMemoryReport(id: string, userId?: string) {
  const report = memoryStore.reports.get(id) ?? null;
  if (!report) return null;
  if (!userId) return report;
  return report.userId === userId ? report : null;
}

export function getMemoryHistory(userId?: string) {
  return Array.from(memoryStore.reports.values())
    .filter((entry) => (userId ? entry.userId === userId : true))
    .map((entry) => entry.report)
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt));
}

export function getMemoryConnectorStatus() {
  const latestPerSource = new Map<string, ConnectorResult>();
  Array.from(memoryStore.reports.values()).forEach((entry) => {
    entry.connectors.forEach((result) => latestPerSource.set(result.source, result));
  });

  return Array.from(latestPerSource.entries()).map(([source, result]) => ({
    source,
    enabled: true,
    healthy: result.healthy,
    message: result.error ?? result.message,
    lastRunAt: new Date().toISOString()
  }));
}

export function getMemoryIngestionRuns() {
  return Array.from(memoryStore.reports.values())
    .flatMap((entry) =>
      entry.connectors.map((connector) => ({
        id: `${entry.report.reportId}-${connector.source}`,
        query: entry.report.query.query,
        source: connector.source,
        startedAt: entry.report.generatedAt,
        endedAt: entry.report.generatedAt,
        status: connector.healthy ? "success" : "error",
        itemCount: connector.items.length,
        errorMessage: connector.error
      }))
    )
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}
