"use client";

import { Fragment, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SentimentReport, SourceName } from "@/lib/types/domain";
import { formatUtcTimestamp } from "@/lib/utils/format";

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

const SOURCE_SECTION_STYLE: Record<SourceName, string> = {
  reddit: "border-orange-400/40 bg-orange-500/10",
  openrouter: "border-cyan-400/40 bg-cyan-500/10",
  youtube: "border-red-400/30 bg-red-500/10",
  tiktok: "border-pink-400/30 bg-pink-500/10",
  facebook: "border-blue-400/30 bg-blue-500/10"
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

  const highlightTerms = useMemo(() => {
    return Array.from(
      new Set(
        report.query.query
          .toLowerCase()
          .split(/[^a-z0-9]+/i)
          .map((term) => term.trim())
          .filter((term) => term.length >= 2)
      )
    );
  }, [report.query.query]);

  const groupedItems = useMemo(() => {
    const grouped = new Map<SourceName, typeof filteredItems>();
    filteredItems.forEach((item) => {
      grouped.set(item.source, [...(grouped.get(item.source) ?? []), item]);
    });
    return Array.from(grouped.entries());
  }, [filteredItems]);

  const renderHighlighted = (text: string) => {
    if (highlightTerms.length === 0 || !text) return text;
    const escaped = highlightTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const matcher = new RegExp(`(${escaped.join("|")})`, "ig");
    const parts = text.split(matcher);

    return parts.map((part, index) => {
      const matched = highlightTerms.includes(part.toLowerCase());
      return matched ? (
        <mark
          key={`${part}-${index}`}
          className="rounded bg-cyan-500/20 px-0.5 py-0 text-cyan-100 ring-1 ring-cyan-400/40"
        >
          {part}
        </mark>
      ) : (
        <Fragment key={`${part}-${index}`}>{part}</Fragment>
      );
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Source Results Explorer</CardTitle>
        <CardDescription>
          Filter analysis by source to inspect exactly what each connector returned. Source sections are collapsed by default.
        </CardDescription>
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
          {groupedItems.length === 0 ? <p className="text-sm text-muted-foreground">No representative items for this source.</p> : null}

          {groupedItems.map(([source, items]) => (
            <details key={source} className={`rounded-lg border p-3 ${SOURCE_SECTION_STYLE[source]}`}>
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{SOURCE_LABELS[source]}</span>
                  <Badge>{items.length} items</Badge>
                </div>
                <span className="text-xs text-muted-foreground">Expand</span>
              </summary>

              <div className="mt-3 space-y-3">
                {items.map((item) => (
                  <details key={`${item.source}-${item.externalId}`} className="rounded-lg border p-3 text-sm">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{renderHighlighted(item.title ?? "Untitled")}</p>
                        <Badge>{SOURCE_LABELS[item.source]}</Badge>
                        {item.author ? <Badge>{item.author}</Badge> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">Expand</span>
                    </summary>
                    <pre className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">{renderHighlighted(item.text)}</pre>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{formatUtcTimestamp(item.publishedAt)}</span>
                      {item.url.includes(".example.com") ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">Mock sample</span>
                      ) : null}
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-primary underline">
                        Source
                      </a>
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
