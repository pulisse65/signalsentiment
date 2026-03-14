"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SourceBreakdown } from "@/lib/types/domain";

const COLORS = ["#0f8fa8", "#205ec6", "#f69c2c", "#f0665e"];

export function SourceBreakdownChart({ data }: { data: SourceBreakdown[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie data={data} dataKey="mentions" nameKey="source" outerRadius={100} label>
            {data.map((entry, index) => (
              <Cell key={entry.source} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
