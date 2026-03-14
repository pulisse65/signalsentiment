import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionVolumeChart } from "@/components/charts/mention-volume-chart";
import { SentimentTrendChart } from "@/components/charts/sentiment-trend-chart";
import { SourceBreakdownChart } from "@/components/charts/source-breakdown-chart";
import { ThemeFrequencyChart } from "@/components/charts/theme-frequency-chart";
import { getReportById } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const report = await getReportById(id, userId);

  if (!report) notFound();

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>{report.entity.canonicalName}</CardTitle>
            <CardDescription>
              {report.query.timeRange} • {report.query.selectedSources.join(", ")} • confidence {Math.round(report.confidence * 100)}%
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Badge>{report.entity.category}</Badge>
            <Badge>Mentions {report.mentionVolume}</Badge>
            <Badge>Momentum {report.momentum}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Overall Score</CardTitle>
            <CardDescription>-100 to +100</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{report.overallScore}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Breakdown</CardTitle>
            <CardDescription>Positive / Neutral / Negative</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>+ {report.breakdown.positivePct}%</p>
            <p>= {report.breakdown.neutralPct}%</p>
            <p>- {report.breakdown.negativePct}%</p>
          </CardContent>
        </Card>
      </section>

      {report.entity.disambiguationRequired && report.entity.candidates ? (
        <Card>
          <CardHeader>
            <CardTitle>Entity Disambiguation</CardTitle>
            <CardDescription>
              This query appears ambiguous. For higher confidence, rerun with a specific category.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            <p>Possible interpretations: {report.entity.candidates.join(", ")}</p>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sentiment Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <SentimentTrendChart data={report.timeseries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Mention Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <MentionVolumeChart data={report.timeseries} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Source Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <SourceBreakdownChart data={report.sourceBreakdown} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Theme Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeFrequencyChart
              data={[...report.topPositiveThemes, ...report.topNegativeThemes]
                .slice(0, 10)
                .map((theme) => ({ theme: theme.theme, count: theme.count }))}
            />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Themes</CardTitle>
            <CardDescription>Positive and negative drivers</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Positive</p>
              <ul className="space-y-2 text-sm">
                {report.topPositiveThemes.map((theme) => (
                  <li key={`pos-${theme.theme}`} className="rounded border px-3 py-2">{theme.theme} ({theme.count})</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Negative</p>
              <ul className="space-y-2 text-sm">
                {report.topNegativeThemes.map((theme) => (
                  <li key={`neg-${theme.theme}`} className="rounded border px-3 py-2">{theme.theme} ({theme.count})</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
            <CardDescription>Anomalies, quality notes, and keywords</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="mb-1 font-medium">Rising Keywords</p>
              <p>{report.risingKeywords.join(", ") || "No strong keyword signal."}</p>
            </div>
            <div>
              <p className="mb-1 font-medium">Anomalies</p>
              <ul className="space-y-1">
                {(report.anomalies.length > 0 ? report.anomalies : ["No major sentiment swings detected."]).map((anomaly) => (
                  <li key={anomaly}>{anomaly}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium">Data Quality</p>
              <ul className="space-y-1">
                {(report.qualityNotes.length > 0 ? report.qualityNotes : ["No data quality issues flagged."]).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Representative Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {report.representativeItems.map((item) => (
            <div key={`${item.source}-${item.externalId}`} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{item.title ?? "Untitled"}</p>
              <p className="mt-1 text-muted-foreground">{item.text}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{item.source}</span>
                <span>{new Date(item.publishedAt).toLocaleString()}</span>
                <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline">
                  Source
                </a>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <a href={`/api/export/${report.reportId}?format=csv`}>Export CSV</a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/api/export/${report.reportId}?format=pdf`}>Export PDF (summary)</a>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/history">View history</Link>
        </Button>
      </div>
    </div>
  );
}
