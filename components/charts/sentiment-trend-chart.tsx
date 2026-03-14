"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TimePoint } from "@/lib/types/domain";
import { format } from "date-fns";

export function SentimentTrendChart({ data }: { data: TimePoint[] }) {
  const normalized = data.map((point) => ({ ...point, label: format(new Date(point.timestamp), "MMM d HH:mm") }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <LineChart data={normalized}>
          <XAxis dataKey="label" minTickGap={40} />
          <YAxis domain={[-100, 100]} />
          <Tooltip />
          <Line type="monotone" dataKey="sentimentScore" stroke="#0f8fa8" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
