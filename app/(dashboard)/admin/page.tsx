import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getConnectorHealth, listIngestionRuns } from "@/lib/repositories/report-repository";
import { formatUtcTimestamp } from "@/lib/utils/format";

function modeBadge(mode: "live" | "fallback" | "disabled") {
  if (mode === "live") return "bg-emerald-100 text-emerald-800";
  if (mode === "fallback") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

type NewsFeedKey = "nasdaq" | "seeking_alpha" | "investing" | "marketwatch";

function parseNewsFeedDegradations(message: string | undefined) {
  if (!message || !message.startsWith("degraded sources:")) return new Map<NewsFeedKey, string>();

  const entries = message
    .replace("degraded sources:", "")
    .split("|")
    .map((entry) => entry.trim())
    .filter(Boolean);

  const map = new Map<NewsFeedKey, string>();
  entries.forEach((entry) => {
    const match = entry.match(/^([^ ]+)\s+\((.+)\)$/);
    const source = (match?.[1] ?? "").toLowerCase() as NewsFeedKey;
    const reason = match?.[2] ?? entry;
    if (source === "nasdaq" || source === "seeking_alpha" || source === "investing" || source === "marketwatch") {
      map.set(source, reason);
    }
  });
  return map;
}

function feedLabel(key: NewsFeedKey) {
  if (key === "seeking_alpha") return "Seeking Alpha";
  if (key === "marketwatch") return "MarketWatch";
  if (key === "investing") return "Investing.com";
  return "Nasdaq";
}

export default async function AdminPage() {
  const health = await getConnectorHealth();
  const runs = await listIngestionRuns();
  const newsConnector = health.find((entry) => entry.source === "news");
  const degradedMap = parseNewsFeedDegradations(newsConnector?.message);
  const feedConfig: Array<{ key: NewsFeedKey; enabled: boolean }> = [
    { key: "nasdaq", enabled: process.env.NEWS_ENABLE_NASDAQ !== "false" },
    { key: "seeking_alpha", enabled: process.env.NEWS_ENABLE_SEEKING_ALPHA !== "false" },
    { key: "investing", enabled: process.env.NEWS_ENABLE_INVESTING !== "false" },
    { key: "marketwatch", enabled: process.env.NEWS_ENABLE_MARKETWATCH === "true" }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Connector Health</CardTitle>
          <CardDescription>Availability, error state, and last run visibility.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {health.length === 0 ? <p className="text-sm text-muted-foreground">No connector runs yet.</p> : null}
            {health.map((status) => (
              <div key={status.source} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium capitalize">{status.source}</p>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${modeBadge(status.mode)}`}>{status.mode}</span>
                    <p className={`text-sm ${status.healthy ? "text-emerald-700" : "text-amber-700"}`}>{status.healthy ? "Healthy" : "Degraded"}</p>
                  </div>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{status.message ?? "No status message."}</p>
                <p className="mt-1 text-xs text-muted-foreground">Last run: {status.lastRunAt ? formatUtcTimestamp(status.lastRunAt) : "N/A"}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>News Feed Health</CardTitle>
          <CardDescription>
            Per-feed visibility for RSS adapters backing the `news` connector.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {!newsConnector ? (
              <p className="text-sm text-muted-foreground">
                No `news` connector runs yet. Run a stock report with News selected.
              </p>
            ) : null}
            {feedConfig.map((feed) => {
              const degradedReason = degradedMap.get(feed.key);
              const status = !feed.enabled ? "disabled" : degradedReason ? "degraded" : "healthy";

              return (
                <div key={feed.key} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{feedLabel(feed.key)}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${
                        status === "healthy"
                          ? "bg-emerald-100 text-emerald-800"
                          : status === "degraded"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status === "degraded"
                      ? degradedReason
                      : status === "disabled"
                        ? "Disabled by environment config."
                        : "No degradation signal in latest connector status."}
                  </p>
                  {newsConnector?.lastRunAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Last news run: {formatUtcTimestamp(newsConnector.lastRunAt)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ingestion Logs</CardTitle>
          <CardDescription>Latest run outcomes, source volume, and connector errors.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {runs.length === 0 ? <p className="text-sm text-muted-foreground">No ingestion runs recorded.</p> : null}
            {runs.slice(0, 20).map((run) => (
              <div key={run.id} className="rounded-lg border p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {run.query} • <span className="capitalize">{run.source}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold uppercase ${modeBadge(run.mode)}`}>{run.mode}</span>
                    <p className={run.status === "success" ? "text-emerald-700" : "text-red-700"}>{run.status}</p>
                  </div>
                </div>
                <p className="mt-1 text-muted-foreground">Items: {run.itemCount}</p>
                <p className="text-xs text-muted-foreground">Started: {formatUtcTimestamp(run.startedAt)}</p>
                {run.errorMessage ? <p className="mt-1 text-xs text-red-700">Error: {run.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
