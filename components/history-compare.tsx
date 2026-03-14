"use client";

import { useMemo, useState } from "react";
import { SentimentReport } from "@/lib/types/domain";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";

export function HistoryCompare({ reports }: { reports: SentimentReport[] }) {
  const [leftId, setLeftId] = useState(reports[0]?.reportId ?? "");
  const [rightId, setRightId] = useState(reports[1]?.reportId ?? reports[0]?.reportId ?? "");

  const { left, right } = useMemo(() => {
    const leftReport = reports.find((report) => report.reportId === leftId);
    const rightReport = reports.find((report) => report.reportId === rightId);
    return { left: leftReport, right: rightReport };
  }, [leftId, rightId, reports]);

  if (reports.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compare Periods</CardTitle>
          <CardDescription>Run at least two reports to compare.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const options = reports.map((report) => ({
    label: `${report.entity.canonicalName} • ${new Date(report.generatedAt).toLocaleString()}`,
    value: report.reportId
  }));

  const scoreDelta = left && right ? Number((right.overallScore - left.overallScore).toFixed(2)) : 0;
  const mentionDelta = left && right ? right.mentionVolume - left.mentionVolume : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Compare Periods</CardTitle>
        <CardDescription>Compare score and volume between two saved reports.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium">Baseline</p>
            <Select value={leftId} onChange={(event) => setLeftId(event.target.value)} options={options} />
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">Comparison</p>
            <Select value={rightId} onChange={(event) => setRightId(event.target.value)} options={options} />
          </div>
        </div>

        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Score Delta</p>
            <p className="text-xl font-semibold">{scoreDelta > 0 ? `+${scoreDelta}` : scoreDelta}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Mention Delta</p>
            <p className="text-xl font-semibold">{mentionDelta > 0 ? `+${mentionDelta}` : mentionDelta}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-muted-foreground">Momentum Shift</p>
            <p className="text-xl font-semibold">
              {left?.momentum ?? "N/A"} → {right?.momentum ?? "N/A"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
