"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TimePoint } from "@/lib/types/domain";
import { format } from "date-fns";

export function MentionVolumeChart({ data }: { data: TimePoint[] }) {
  const normalized = data.map((point) => ({ ...point, label: format(new Date(point.timestamp), "MMM d HH:mm") }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <AreaChart data={normalized}>
          <XAxis dataKey="label" minTickGap={40} />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Area type="monotone" dataKey="mentions" stroke="#205ec6" fill="#79a3f5" fillOpacity={0.35} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
