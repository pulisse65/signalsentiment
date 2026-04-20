"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshJobStatus, SourceName } from "@/lib/types/domain";

interface RefreshReportButtonProps {
  reportId: string;
  variant?: "default" | "outline" | "ghost";
}

const SOURCE_LABELS: Record<SourceName, string> = {
  reddit: "Reddit",
  openrouter: "OpenRouter",
  news: "News",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook"
};

function stepColor(status: RefreshJobStatus["steps"][number]["status"]) {
  if (status === "completed") return "bg-emerald-500";
  if (status === "error") return "bg-red-500";
  if (status === "running") return "bg-cyan-500";
  if (status === "skipped") return "bg-slate-500";
  return "bg-slate-400";
}

export function RefreshReportButton({ reportId, variant = "outline" }: RefreshReportButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<RefreshJobStatus | null>(null);

  useEffect(() => {
    if (!isLoading) {
      setElapsed(0);
      return;
    }

    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!jobId || !isLoading) return;

    let isActive = true;
    const poll = async () => {
      try {
        const response = await fetch(`/api/report/refresh-jobs/${jobId}`, { cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to check refresh status");
        if (!isActive) return;

        const status = payload as RefreshJobStatus;
        setJobStatus(status);

        if (status.status === "completed" && status.resultReportId) {
          setIsLoading(false);
          setJobId(null);
          router.push(`/report/${status.resultReportId}?compare=${reportId}`);
          return;
        }

        if (status.status === "error") {
          setIsLoading(false);
          setJobId(null);
          setError(status.error ?? "Refresh failed");
        }
      } catch (err) {
        if (!isActive) return;
        setIsLoading(false);
        setJobId(null);
        setError(err instanceof Error ? err.message : "Refresh polling failed");
      }
    };

    void poll();
    const interval = window.setInterval(() => void poll(), 1200);
    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [jobId, isLoading, reportId, router]);

  const onRefresh = async () => {
    setError(null);
    setJobStatus(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/report/${reportId}/refresh`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to refresh report");
      if (!payload.jobId) throw new Error("Refresh job did not start");
      setJobId(payload.jobId as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown refresh error");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button type="button" variant={variant} onClick={onRefresh} disabled={isLoading}>
        {isLoading ? "Refreshing..." : "Refresh now + auto compare"}
      </Button>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-700/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500"
              style={{
                width: `${Math.max(12, jobStatus?.progressPct ?? 15)}%`,
                animation: "search-progress-shimmer 1.2s ease-in-out infinite"
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Refreshing sources and recalculating sentiment... {elapsed}s
            {jobStatus ? ` (${jobStatus.progressPct}%)` : ""}
          </p>
          {jobStatus?.steps?.length ? (
            <div className="space-y-1 rounded-md border border-border/60 bg-card/70 p-2">
              {jobStatus.steps.map((step) => (
                <div key={step.source} className="flex items-center justify-between gap-3 text-xs">
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${stepColor(step.status)}`} />
                    {SOURCE_LABELS[step.source]}
                  </span>
                  <span className="text-muted-foreground capitalize">
                    {step.status}
                    {typeof step.itemCount === "number" ? ` (${step.itemCount})` : ""}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
