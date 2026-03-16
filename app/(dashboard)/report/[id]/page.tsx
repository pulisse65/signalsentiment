import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MentionVolumeChart } from "@/components/charts/mention-volume-chart";
import { SentimentTrendChart } from "@/components/charts/sentiment-trend-chart";
import { SourceBreakdownChart } from "@/components/charts/source-breakdown-chart";
import { ThemeFrequencyChart } from "@/components/charts/theme-frequency-chart";
import { ReportSourceExplorer } from "@/components/report-source-explorer";
import { DeleteReportButton } from "@/components/delete-report-button";
import { RefreshReportButton } from "@/components/refresh-report-button";
import { findPreviousComparableReport, getReportById } from "@/lib/repositories/report-repository";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { formatUtcTimestamp } from "@/lib/utils/format";

export default async function ReportPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ compare?: string }>;
}) {
  const { id } = await params;
  const { compare } = await searchParams;
  const userId = await getCurrentUserId();
  const report = await getReportById(id, userId);

  if (!report) notFound();
  const explicitComparison = compare && compare !== id ? await getReportById(compare, userId) : null;
  const previousComparable = explicitComparison ?? (await findPreviousComparableReport(report, userId));
  const scoreDelta = previousComparable ? Number((report.overallScore - previousComparable.overallScore).toFixed(2)) : null;
  const mentionDelta = previousComparable ? report.mentionVolume - previousComparable.mentionVolume : null;
  const confidenceDelta =
    previousComparable ? Number(((report.confidence - previousComparable.confidence) * 100).toFixed(1)) : null;

  const themeChartData = [...report.topPositiveThemes, ...report.topNegativeThemes]
    .slice(0, 10)
    .map((theme) => ({ theme: theme.theme, count: theme.count }));
  const fallbackThemeData = report.risingKeywords.slice(0, 8).map((theme, idx) => ({ theme, count: Math.max(1, 8 - idx) }));
  const effectiveThemeData = themeChartData.length > 0 ? themeChartData : fallbackThemeData;
  const positiveThemesToShow =
    report.topPositiveThemes.length > 0
      ? report.topPositiveThemes
      : fallbackThemeData.slice(0, 5).map((item) => ({ theme: item.theme, sentiment: "positive" as const, count: item.count }));
  const negativeThemesToShow =
    report.topNegativeThemes.length > 0
      ? report.topNegativeThemes
      : fallbackThemeData.slice(5, 10).map((item) => ({ theme: item.theme, sentiment: "negative" as const, count: item.count }));

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
            <ThemeFrequencyChart data={effectiveThemeData} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Auto Compare</CardTitle>
            <CardDescription>
              Compare this report to the most recent previous run with the same query configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {previousComparable ? (
              <>
                <p className="text-muted-foreground">
                  Baseline: {formatUtcTimestamp(previousComparable.generatedAt)}
                </p>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Score Delta</p>
                    <p className="text-lg font-semibold">{(scoreDelta ?? 0) > 0 ? `+${scoreDelta}` : scoreDelta}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Mention Delta</p>
                    <p className="text-lg font-semibold">{(mentionDelta ?? 0) > 0 ? `+${mentionDelta}` : mentionDelta}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Confidence Delta</p>
                    <p className="text-lg font-semibold">
                      {(confidenceDelta ?? 0) > 0 ? `+${confidenceDelta}` : confidenceDelta}%
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No previous comparable run yet. Use refresh to create one.</p>
            )}
            <RefreshReportButton reportId={report.reportId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Themes</CardTitle>
            <CardDescription>Positive and negative drivers</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium">Positive</p>
              <ul className="space-y-2 text-sm">
                {positiveThemesToShow.map((theme) => (
                  <li key={`pos-${theme.theme}`} className="rounded border px-3 py-2">{theme.theme} ({theme.count})</li>
                ))}
                {positiveThemesToShow.length === 0 ? <li className="rounded border px-3 py-2 text-muted-foreground">No dominant positive themes detected.</li> : null}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Negative</p>
              <ul className="space-y-2 text-sm">
                {negativeThemesToShow.map((theme) => (
                  <li key={`neg-${theme.theme}`} className="rounded border px-3 py-2">{theme.theme} ({theme.count})</li>
                ))}
                {negativeThemesToShow.length === 0 ? <li className="rounded border px-3 py-2 text-muted-foreground">No dominant negative themes detected.</li> : null}
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
          <CardTitle>How Scoring Works</CardTitle>
          <CardDescription>Transparent scoring from content polarity, engagement, and recency.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. Content is normalized, deduplicated, and relevance-filtered (especially for Reddit).</p>
          <p>2. Each item gets a polarity score from either explicit model sentiment signals or lexical sentiment rules.</p>
          <p>3. Scores are weighted by engagement (comments/upvotes/likes/views) and freshness (newer items weigh more).</p>
          <p>4. Final score is mapped to -100..+100, with per-source breakdown and confidence notes.</p>
        </CardContent>
      </Card>

      <ReportSourceExplorer report={report} />

      <div className="flex flex-wrap gap-3">
        <RefreshReportButton reportId={report.reportId} />
        <Button asChild>
          <a href={`/api/export/${report.reportId}?format=csv`}>Export CSV</a>
        </Button>
        <Button variant="outline" asChild>
          <a href={`/api/export/${report.reportId}?format=pdf`}>Export PDF (summary)</a>
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/history">View history</Link>
        </Button>
        <DeleteReportButton reportId={report.reportId} redirectTo="/history" />
      </div>
    </div>
  );
}
