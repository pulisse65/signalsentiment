import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteReportButton } from "@/components/delete-report-button";
import { HistoryCompare } from "@/components/history-compare";
import { RefreshReportButton } from "@/components/refresh-report-button";
import { listReports } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { formatUtcTimestamp } from "@/lib/utils/format";

export default async function HistoryPage() {
  const userId = await getCurrentUserId();
  const reports = await listReports(userId);

  return (
    <div className="space-y-6">
      <HistoryCompare reports={reports} />
      <Card>
        <CardHeader>
          <CardTitle>Report History</CardTitle>
          <CardDescription>Saved searches and generated sentiment reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {reports.length === 0 ? <p className="text-sm text-muted-foreground">No report history yet.</p> : null}
            {reports.map((report) => (
              <div key={report.reportId} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/report/${report.reportId}`} className="font-medium underline-offset-4 hover:underline">
                    {report.entity.canonicalName}
                  </Link>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">{formatUtcTimestamp(report.generatedAt)}</p>
                    <DeleteReportButton reportId={report.reportId} variant="ghost" />
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>Score: {report.overallScore}</span>
                  <span>Mentions: {report.mentionVolume}</span>
                  <span>Category: {report.entity.category}</span>
                </div>
                <div className="mt-3">
                  <RefreshReportButton reportId={report.reportId} variant="ghost" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
