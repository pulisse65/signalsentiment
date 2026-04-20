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
import { findPreviousComparableReport, getReportById, getStockTrendSnapshot } from "@/lib/repositories/report-repository";
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
  const stockSnapshot = report.entity.category === "stock" ? await getStockTrendSnapshot(report, userId, 30) : null;
  const scoreDelta = previousComparable ? Number((report.overallScore - previousComparable.overallScore).toFixed(2)) : null;
  const mentionDelta = previousComparable ? report.mentionVolume - previousComparable.mentionVolume : null;
  const confidenceDelta =
    previousComparable ? Number(((report.confidence - previousComparable.confidence) * 100).toFixed(1)) : null;

  const sentimentLabel = report.overallScore >= 20 ? "Positive" : report.overallScore <= -20 ? "Negative" : "Mixed / Neutral";
  const confidenceLabel = report.confidence >= 0.75 ? "High" : report.confidence >= 0.55 ? "Medium" : "Low";
  const quickTakeaway =
    report.momentum === "up"
      ? "Sentiment is strengthening recently."
      : report.momentum === "down"
        ? "Sentiment is weakening recently."
        : "Sentiment is stable with no major recent shift.";

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
            <p className="mt-2 text-xs text-muted-foreground">Guide: +20+ positive, -20- negative, between is mixed/neutral.</p>
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
            <CardTitle>Quick Read</CardTitle>
            <CardDescription>Fast interpretation of what this report means.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Sentiment</p>
                <p className="text-lg font-semibold">{sentimentLabel}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Trend</p>
                <p className="text-lg font-semibold capitalize">{report.momentum}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Confidence</p>
                <p className="text-lg font-semibold">{confidenceLabel}</p>
              </div>
            </div>
            <p className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-cyan-100">{quickTakeaway}</p>
            <p className="text-xs text-muted-foreground">
              Tip: start with Overall Score + Trend, then validate with Source Results Explorer to inspect real posts/models.
            </p>
          </CardContent>
        </Card>

        {stockSnapshot ? (
          <Card>
            <CardHeader>
              <CardTitle>Stock Sentiment Dashboard (30d)</CardTitle>
              <CardDescription>Momentum and performance based on sentiment movement and mention growth.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Momentum Score</p>
                  <p className="text-lg font-semibold">{stockSnapshot.sentimentMomentumScore}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">30d Score Change</p>
                  <p className="text-lg font-semibold">
                    {stockSnapshot.scoreDelta > 0 ? `+${stockSnapshot.scoreDelta}` : stockSnapshot.scoreDelta}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">30d Mention Growth</p>
                  <p className="text-lg font-semibold">
                    {stockSnapshot.mentionGrowthPct > 0 ? `+${stockSnapshot.mentionGrowthPct}` : stockSnapshot.mentionGrowthPct}%
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Window: {formatUtcTimestamp(stockSnapshot.windowStart)} {"->"} {formatUtcTimestamp(stockSnapshot.windowEnd)} •{" "}
                {stockSnapshot.reportCount} tracked runs
              </p>
              <Button variant="outline" asChild>
                <Link href="/stocks">Open 30d Stock Leaderboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </section>

      {report.newsSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>News Summary (RSS)</CardTitle>
            <CardDescription>
              {report.newsSummary.articleCount} relevant deduplicated articles • last updated{" "}
              {formatUtcTimestamp(report.newsSummary.lastUpdated)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Aggregate News Sentiment</p>
                <p className="text-lg font-semibold">{report.newsSummary.aggregateSentiment}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Sources Used</p>
                <p className="text-lg font-semibold">{report.newsSummary.sourcesUsed.join(", ") || "none"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-muted-foreground">Articles</p>
                <p className="text-lg font-semibold">{report.newsSummary.articleCount}</p>
              </div>
            </div>
            {report.newsSummary.degradedSources && report.newsSummary.degradedSources.length > 0 ? (
              <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-amber-100">
                <p className="font-medium">Some news sources were degraded:</p>
                <ul className="mt-1 space-y-1">
                  {report.newsSummary.degradedSources.map((entry) => (
                    <li key={`${entry.source}-${entry.message}`}>
                      {entry.source}: {entry.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
          <p>5. Stock momentum score (if category is stock) combines score change + mention growth over the last 30 days.</p>
          <p>6. RSS news items additionally weight source priority and ticker/company relevance confidence.</p>
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
