"use client";

import { type ReactNode, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type AdvertisingMetrics = {
  ad_spend_usd: string;
  ad_clicks: number;
  active_campaigns: number;
};

type Summary = {
  agent_status: string;
  phone_number: string | null;
  calls_this_month: number;
  minutes_used: number;
  billing_status: string;
  advertising?: AdvertisingMetrics | null;
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

  const voiceCards = [
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

  const ads = summary.advertising;
  const adCards = ads
    ? [
        {
          title: "Ad spend (est.)",
          value: `$${Number(ads.ad_spend_usd).toFixed(2)}`,
          accent: true,
        },
        {
          title: "Ad clicks",
          value: String(ads.ad_clicks),
          accent: true,
        },
        {
          title: "Active campaigns",
          value: String(ads.active_campaigns),
          accent: true,
        },
      ]
    : [];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-600">Voice agent overview and AdsFind performance</p>

      {adCards.length > 0 ? (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-ads-teal-dark">
            Advertising
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adCards.map((card) => (
              <MetricCard key={card.title} title={card.title} value={card.value} accent />
            ))}
          </div>
        </>
      ) : null}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Voice agent</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {voiceCards.map((card) => (
          <MetricCard key={card.title} title={card.title} value={card.value} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${
        accent ? "border-ads-teal/30 bg-gradient-to-br from-slate-900 to-slate-800" : "border-slate-200 bg-white"
      }`}
    >
      <p
        className={`text-sm font-medium ${accent ? "text-ads-teal" : "text-slate-500"}`}
      >
        {title}
      </p>
      <div className={`mt-2 text-lg font-semibold ${accent ? "text-white" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}
