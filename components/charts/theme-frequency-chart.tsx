"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function ThemeFrequencyChart({ data }: { data: Array<{ theme: string; count: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ left: 8, right: 16, top: 10, bottom: 0 }}>
          <defs>
            <linearGradient id="themeBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-violet)" />
              <stop offset="100%" stopColor="var(--chart-cyan)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 4" />
          <XAxis dataKey="theme" interval={0} angle={-20} textAnchor="end" height={70} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: "1px solid var(--chart-tooltip-border)",
              background: "var(--chart-tooltip-bg)",
              backdropFilter: "blur(6px)"
            }}
          />
          <Bar dataKey="count" fill="url(#themeBarGradient)" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
