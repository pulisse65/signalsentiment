import { NextResponse } from "next/server";
import { getRefreshJob } from "@/lib/repositories/refresh-job-store";
import { getCurrentUserId } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const userId = await getCurrentUserId();
  const job = getRefreshJob(jobId, userId);

  if (!job) {
    return NextResponse.json({ error: "Refresh job not found" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.jobId,
    baseReportId: job.baseReportId,
    status: job.status,
    progressPct: job.progressPct,
    startedAt: job.startedAt,
    endedAt: job.endedAt,
    resultReportId: job.resultReportId,
    error: job.error,
    steps: job.steps
  });
}
