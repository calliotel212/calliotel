"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Mock series until advertiser click history API is exposed. */
export const MOCK_AD_CLICKS_7D = [
  { day: "Mon", clicks: 12 },
  { day: "Tue", clicks: 18 },
  { day: "Wed", clicks: 9 },
  { day: "Thu", clicks: 24 },
  { day: "Fri", clicks: 31 },
  { day: "Sat", clicks: 14 },
  { day: "Sun", clicks: 22 },
];

type Props = {
  dark?: boolean;
  data?: { day: string; clicks: number }[];
};

export function AdClicksChart({ dark = true, data = MOCK_AD_CLICKS_7D }: Props) {
  const tick = dark ? "#64748b" : "#94a3b8";
  const grid = dark ? "rgba(100, 116, 139, 0.2)" : "rgba(148, 163, 184, 0.35)";

  return (
    <div
      className={`rounded-xl border p-5 backdrop-blur-md ${
        dark
          ? "border-slate-700/80 bg-slate-900/40 shadow-lg shadow-black/20"
          : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <h3 className={`text-sm font-semibold ${dark ? "text-white" : "text-slate-900"}`}>
        Ad clicks over the last 7 days
      </h3>
      <p className={`mt-1 text-xs ${dark ? "text-slate-500" : "text-slate-500"}`}>
        Sample traffic — live API series coming soon
      </p>
      <div className="mt-4 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(10, 15, 28, 0.95)",
                border: "1px solid rgba(0, 229, 255, 0.25)",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "#94a3b8" }}
              itemStyle={{ color: "#00E5FF" }}
            />
            <Line
              type="monotone"
              dataKey="clicks"
              stroke="#00E5FF"
              strokeWidth={2}
              dot={{ r: 3, fill: "#00E5FF" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}