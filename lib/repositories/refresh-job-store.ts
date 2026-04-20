import crypto from "node:crypto";
import { RefreshJobStatus, RefreshStepState, SearchInput, SourceName } from "@/lib/types/domain";

const JOB_TTL_MS = 1000 * 60 * 60 * 24;

interface RefreshJobStoreRecord extends RefreshJobStatus {
  userId?: string;
  query: SearchInput;
}

const refreshJobs = new Map<string, RefreshJobStoreRecord>();

const EXPECTED_STEP_MS: Record<SourceName, number> = {
  reddit: 30000,
  openrouter: 120000,
  news: 45000,
  youtube: 15000,
  tiktok: 15000,
  facebook: 20000
};

function cleanupExpiredJobs() {
  const now = Date.now();
  Array.from(refreshJobs.entries()).forEach(([jobId, job]) => {
    if (now - Date.parse(job.startedAt) > JOB_TTL_MS) {
      refreshJobs.delete(jobId);
    }
  });
}

function recalcProgress(job: RefreshJobStoreRecord) {
  const total = Math.max(job.steps.length, 1);
  const finished = job.steps.filter((step) => ["completed", "skipped", "error"].includes(step.status)).length;
  const now = Date.now();
  const runningFraction = job.steps
    .filter((step) => step.status === "running")
    .reduce((sum, step) => {
      const startedAtMs = step.startedAt ? Date.parse(step.startedAt) : now;
      const elapsedMs = Math.max(0, now - startedAtMs);
      const expectedMs = EXPECTED_STEP_MS[step.source] ?? 30000;
      return sum + Math.min(0.95, elapsedMs / expectedMs);
    }, 0);

  const combined = (finished + runningFraction) / total;
  job.progressPct = Math.min(99, Math.round(combined * 100));
}

function updateStep(job: RefreshJobStoreRecord, source: SourceName, status: RefreshStepState, details?: Partial<RefreshJobStatus["steps"][number]>) {
  job.steps = job.steps.map((step) => (step.source === source ? { ...step, status, ...details } : step));
  recalcProgress(job);
}

export function createRefreshJob(baseReportId: string, query: SearchInput, userId?: string) {
  cleanupExpiredJobs();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const record: RefreshJobStoreRecord = {
    jobId,
    baseReportId,
    status: "queued",
    progressPct: 0,
    startedAt: now,
    steps: query.selectedSources.map((source) => ({
      source,
      status: "pending"
    })),
    userId,
    query
  };
  refreshJobs.set(jobId, record);
  return record;
}

export function getRefreshJob(jobId: string, userId?: string): RefreshJobStoreRecord | null {
  const job = refreshJobs.get(jobId) ?? null;
  if (!job) return null;
  if (userId && job.userId && job.userId !== userId) return null;
  if (job.status === "queued" || job.status === "running") {
    recalcProgress(job);
  }
  return job;
}

export function markRefreshJobRunning(jobId: string) {
  const job = refreshJobs.get(jobId);
  if (!job) return;
  job.status = "running";
}

export function markRefreshStepRunning(jobId: string, source: SourceName, message?: string) {
  const job = refreshJobs.get(jobId);
  if (!job) return;
  updateStep(job, source, "running", { startedAt: new Date().toISOString(), message });
}

export function markRefreshStepFinished(
  jobId: string,
  source: SourceName,
  details: {
    status: "completed" | "skipped" | "error";
    message?: string;
    error?: string;
    itemCount?: number;
  }
) {
  const job = refreshJobs.get(jobId);
  if (!job) return;
  updateStep(job, source, details.status, {
    endedAt: new Date().toISOString(),
    message: details.message,
    error: details.error,
    itemCount: details.itemCount
  });
}

export function markRefreshJobCompleted(jobId: string, resultReportId: string) {
  const job = refreshJobs.get(jobId);
  if (!job) return;
  job.status = "completed";
  job.resultReportId = resultReportId;
  job.endedAt = new Date().toISOString();
  job.progressPct = 100;
}

export function markRefreshJobFailed(jobId: string, error: string) {
  const job = refreshJobs.get(jobId);
  if (!job) return;
  job.status = "error";
  job.error = error;
  job.endedAt = new Date().toISOString();
  job.progressPct = 100;
}
