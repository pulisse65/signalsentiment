import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { HistoryCompare } from "@/components/history-compare";
import { listReports } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";

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
              <Link key={report.reportId} href={`/report/${report.reportId}`} className="block rounded-lg border p-4 hover:bg-secondary">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">{report.entity.canonicalName}</p>
                  <p className="text-sm text-muted-foreground">{new Date(report.generatedAt).toLocaleString()}</p>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span>Score: {report.overallScore}</span>
                  <span>Mentions: {report.mentionVolume}</span>
                  <span>Category: {report.entity.category}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
