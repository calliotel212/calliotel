"use client";

import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type Summary = {
  agent_status: string;
  phone_number: string | null;
  calls_this_month: number;
  minutes_used: number;
  billing_status: string;
};

function StatusBadge({ value }: { value: string }) {
  const online = value === "online";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        online ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700"
      }`}
    >
      {value}
    </span>
  );
}

export default function DashboardHomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<Summary>("/api/v1/dashboard/summary", token)
      .then(setSummary)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load summary"));
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-slate-600">Loading dashboard…</p>;
  }

  const cards = [
    {
      title: "Agent status",
      value: <StatusBadge value={summary.agent_status} />,
    },
    {
      title: "Phone number",
      value: summary.phone_number ?? "Not assigned",
    },
    {
      title: "Calls this month",
      value: String(summary.calls_this_month),
    },
    {
      title: "Minutes used",
      value: String(summary.minutes_used),
    },
    {
      title: "Billing",
      value: summary.billing_status.replace("_", " "),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Overview of your AI phone agent</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <div className="mt-2 text-lg font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
