import { NextResponse } from "next/server";
import { generateReport } from "@/lib/pipeline/report";
import { getReportById } from "@/lib/repositories/report-repository";
import {
  createRefreshJob,
  markRefreshJobCompleted,
  markRefreshJobFailed,
  markRefreshJobRunning,
  markRefreshStepFinished,
  markRefreshStepRunning
} from "@/lib/repositories/refresh-job-store";
import { getCurrentUserId } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const existing = await getReportById(id, userId);

  if (!existing) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  const defaultTimeoutMs = existing.query.selectedSources.includes("openrouter") ? 240000 : 90000;
  const refreshTimeout = Math.max(15000, Number(process.env.REFRESH_TIMEOUT_MS ?? String(defaultTimeoutMs)));
  const job = createRefreshJob(id, existing.query, userId);

  void (async () => {
    try {
      markRefreshJobRunning(job.jobId);
      const refreshed = await Promise.race([
        generateReport(existing.query, userId, {
          onSourceStatus: (event) => {
            if (event.phase === "started") {
              markRefreshStepRunning(job.jobId, event.source, "Fetching source data");
              return;
            }

            if (event.phase === "failed") {
              markRefreshStepFinished(job.jobId, event.source, {
                status: "error",
                error: event.error ?? "Connector failed",
                message: event.message,
                itemCount: event.itemCount ?? 0
              });
              return;
            }

            const finalStatus = event.mode === "disabled" ? "skipped" : event.error ? "error" : "completed";
            markRefreshStepFinished(job.jobId, event.source, {
              status: finalStatus,
              error: event.error,
              message: event.message,
              itemCount: event.itemCount ?? 0
            });
          }
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Refresh timed out after ${Math.round(refreshTimeout / 1000)}s`)), refreshTimeout)
        )
      ]);

      markRefreshJobCompleted(job.jobId, refreshed.reportId);
    } catch (error) {
      markRefreshJobFailed(job.jobId, error instanceof Error ? error.message : "Failed to refresh report");
    }
  })();

  return NextResponse.json({ jobId: job.jobId, status: job.status });
}
