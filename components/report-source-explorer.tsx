"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SentimentReport, SourceName } from "@/lib/types/domain";

interface ReportSourceExplorerProps {
  report: SentimentReport;
}

const SOURCE_LABELS: Record<SourceName, string> = {
  reddit: "Reddit",
  openrouter: "OpenRouter",
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook"
};

export function ReportSourceExplorer({ report }: ReportSourceExplorerProps) {
  const [selectedSource, setSelectedSource] = useState<"all" | SourceName>("all");

  const availableSources = useMemo(() => {
    const fromBreakdown = report.sourceBreakdown.map((source) => source.source);
    const fromItems = report.representativeItems.map((item) => item.source);
    return Array.from(new Set([...fromBreakdown, ...fromItems]));
  }, [report]);

  const filteredItems = useMemo(() => {
    if (selectedSource === "all") return report.representativeItems;
    return report.representativeItems.filter((item) => item.source === selectedSource);
  }, [report, selectedSource]);

  const countBySource = useMemo(() => {
    const counts = new Map<SourceName, number>();
    report.representativeItems.forEach((item) => {
      counts.set(item.source, (counts.get(item.source) ?? 0) + 1);
    });
    return counts;
  }, [report]);

  const selectedBreakdown =
    selectedSource === "all"
      ? null
      : report.sourceBreakdown.find((source) => source.source === selectedSource) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Results Explorer</CardTitle>
        <CardDescription>Filter analysis by source to inspect exactly what each connector returned.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 text-sm ${selectedSource === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
            onClick={() => setSelectedSource("all")}
          >
            All Sources
          </button>
          {availableSources.map((source) => (
            <button
              key={source}
              type="button"
              className={`rounded-full border px-3 py-1 text-sm ${selectedSource === source ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
              onClick={() => setSelectedSource(source)}
            >
              {SOURCE_LABELS[source]} ({countBySource.get(source) ?? 0})
            </button>
          ))}
        </div>

        {selectedBreakdown ? (
          <div className="rounded-lg border p-3 text-sm">
            <p className="font-medium">{SOURCE_LABELS[selectedBreakdown.source]} Summary</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>Score {selectedBreakdown.sentimentScore}</Badge>
              <Badge>Mentions {selectedBreakdown.mentions}</Badge>
              <Badge>+ {selectedBreakdown.breakdown.positivePct}%</Badge>
              <Badge>= {selectedBreakdown.breakdown.neutralPct}%</Badge>
              <Badge>- {selectedBreakdown.breakdown.negativePct}%</Badge>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          {filteredItems.length === 0 ? <p className="text-sm text-muted-foreground">No representative items for this source.</p> : null}
          {filteredItems.map((item) => (
            <div key={`${item.source}-${item.externalId}`} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{item.title ?? "Untitled"}</p>
                <Badge>{SOURCE_LABELS[item.source]}</Badge>
                {item.author ? <Badge>{item.author}</Badge> : null}
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.text}</pre>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{new Date(item.publishedAt).toLocaleString()}</span>
                {item.url.includes(".example.com") ? (
                  <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Mock sample</span>
                ) : null}
                <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline">
                  Source
                </a>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
