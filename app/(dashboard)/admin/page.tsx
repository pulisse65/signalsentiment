import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getConnectorHealth, listIngestionRuns } from "@/lib/repositories/report-repository";

function modeBadge(mode: "live" | "fallback" | "disabled") {
  if (mode === "live") return "bg-emerald-100 text-emerald-800";
  if (mode === "fallback") return "bg-amber-100 text-amber-800";
  return "bg-slate-200 text-slate-700";
}

export default async function AdminPage() {
  const health = await getConnectorHealth();
  const runs = await listIngestionRuns();

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
                <p className="mt-1 text-xs text-muted-foreground">Last run: {status.lastRunAt ? new Date(status.lastRunAt).toLocaleString() : "N/A"}</p>
              </div>
            ))}
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
                <p className="text-xs text-muted-foreground">Started: {new Date(run.startedAt).toLocaleString()}</p>
                {run.errorMessage ? <p className="mt-1 text-xs text-red-700">Error: {run.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
