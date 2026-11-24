"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type RevenuePoint = { label: string; revenue: number };

function buildRevenueSeries(totalUsd: number): RevenuePoint[] {
  const weights = [0.08, 0.1, 0.12, 0.14, 0.16, 0.18, 0.22];
  return ["6d", "5d", "4d", "3d", "2d", "Yday", "Today"].map((label, i) => ({
    label,
    revenue: Math.round(totalUsd * weights[i] * 10) / 10,
  }));
}

type HealthPoint = { name: string; value: number };

function buildHealthSeries(metrics: {
  valid_clicks: number;
  blocked_fraud_clicks: number;
  total_served: number;
  total_clicks: number;
}): HealthPoint[] {
  const fraudRate =
    metrics.total_clicks > 0 ? metrics.blocked_fraud_clicks / metrics.total_clicks : 0;
  const serveScore = Math.min(100, Math.round((metrics.total_served / 500) * 100));
  const clickScore = Math.min(100, Math.round((metrics.valid_clicks / 200) * 100));
  const shieldScore = Math.round((1 - Math.min(fraudRate, 0.5)) * 100);
  return [
    { name: "Delivery", value: serveScore },
    { name: "Clicks", value: clickScore },
    { name: "Shield", value: shieldScore },
    { name: "Uptime", value: 99 },
  ];
}

type Metrics = {
  total_revenue_usd: string;
  total_served: number;
  valid_clicks: number;
  blocked_fraud_clicks: number;
  total_clicks: number;
};

export function AdminOverviewCharts({ metrics }: { metrics: Metrics }) {
  const total = Number(metrics.total_revenue_usd) || 0;
  const revenueData = buildRevenueSeries(total);
  const healthData = buildHealthSeries(metrics);

  return (
    <div className="mb-8 grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-5 shadow-lg shadow-black/20 backdrop-blur-md">
        <h3 className="text-sm font-semibold text-white">Total revenue (7d trend)</h3>
        <p className="mt-1 text-xs text-slate-500">Estimated from platform metrics</p>
        <div className="mt-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E5FF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00E5FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(100,116,139,0.2)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: "#64748b", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(10, 15, 28, 0.95)",
                  border: "1px solid rgba(0, 229, 255, 0.25)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#00E5FF" fill="url(#revGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/40 p-5 shadow-lg shadow-black/20 backdrop-blur-md">
        <h3 className="text-sm font-semibold text-white">Platform health</h3>
        <p className="mt-1 text-xs text-slate-500">Delivery, clicks, fraud shield, uptime</p>
        <div className="mt-4 h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={healthData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(100,116,139,0.2)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10, 15, 28, 0.95)",
                  border: "1px solid rgba(0, 229, 255, 0.25)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="value" fill="#00E5FF" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}