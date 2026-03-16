"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TimePoint } from "@/lib/types/domain";
import { format } from "date-fns";

export function MentionVolumeChart({ data }: { data: TimePoint[] }) {
  const normalized = data.map((point) => ({ ...point, label: format(new Date(point.timestamp), "MMM d HH:mm") }));
  if (normalized.length === 0) {
    return <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">No mention-volume data available for this search.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={normalized} margin={{ left: 8, right: 16, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="sentiVolumeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-blue)" stopOpacity={0.75} />
              <stop offset="70%" stopColor="var(--chart-cyan)" stopOpacity={0.3} />
              <stop offset="100%" stopColor="var(--chart-cyan)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" />
          <XAxis dataKey="label" minTickGap={40} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--chart-tooltip-border)",
              background: "var(--chart-tooltip-bg)",
              backdropFilter: "blur(6px)"
            }}
          />
          <Area type="monotone" dataKey="mentions" stroke="var(--chart-blue)" strokeWidth={2.6} fill="url(#sentiVolumeFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
