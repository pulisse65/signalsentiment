import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listReports } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { Badge } from "@/components/ui/badge";
import { formatUtcTimestamp } from "@/lib/utils/format";

export default async function HomePage() {
  const userId = await getCurrentUserId();
  const recentReports = (await listReports(userId)).slice(0, 5);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border/70 bg-card/70 p-6 backdrop-blur">
        <h1 className="text-3xl font-semibold tracking-tight">Senti</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Track sentiment momentum across Reddit, OpenRouter AI, YouTube, TikTok, and Facebook for stocks, sports teams, and products.
        </p>
      </section>

      <SearchForm />

      <Card>
        <CardHeader>
          <CardTitle>Recent Searches</CardTitle>
          <CardDescription>Re-open your latest sentiment reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentReports.length === 0 ? <p className="text-sm text-muted-foreground">No reports yet. Run your first analysis above.</p> : null}
            {recentReports.map((report) => (
              <Link key={report.reportId} href={`/report/${report.reportId}`} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 hover:bg-secondary">
                <div>
                  <p className="font-medium">{report.entity.canonicalName}</p>
                  <p className="text-sm text-muted-foreground">{formatUtcTimestamp(report.generatedAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{report.entity.category}</Badge>
                  <span className="text-sm font-semibold">{report.overallScore}</span>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
