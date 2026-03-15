"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SourceBreakdown } from "@/lib/types/domain";

const COLORS = [
  "var(--chart-cyan)",
  "var(--chart-blue)",
  "var(--chart-violet)",
  "var(--chart-orange)",
  "var(--chart-pink)"
];

export function SourceBreakdownChart({ data }: { data: SourceBreakdown[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="mentions" nameKey="source" outerRadius={104} innerRadius={44} label>
            {data.map((entry, index) => (
              <Cell key={entry.source} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--chart-tooltip-border)",
              background: "var(--chart-tooltip-bg)",
              backdropFilter: "blur(6px)"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
