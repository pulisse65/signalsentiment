"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TimePoint } from "@/lib/types/domain";
import { format } from "date-fns";

export function SentimentTrendChart({ data }: { data: TimePoint[] }) {
  const normalized = data.map((point) => ({ ...point, label: format(new Date(point.timestamp), "MMM d HH:mm") }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={normalized} margin={{ left: 8, right: 16, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="sentiTrendLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--chart-cyan)" />
              <stop offset="50%" stopColor="var(--chart-blue)" />
              <stop offset="100%" stopColor="var(--chart-violet)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" />
          <XAxis dataKey="label" minTickGap={40} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis domain={[-100, 100]} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--chart-tooltip-border)",
              background: "var(--chart-tooltip-bg)",
              backdropFilter: "blur(6px)"
            }}
          />
          <Line type="monotone" dataKey="sentimentScore" stroke="url(#sentiTrendLine)" strokeWidth={3.2} dot={false} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
