"use client";

import { AdsManagerPanel } from "@/components/ads/ads-manager-panel";
import { getAccessToken } from "@/lib/auth";

export default function DashboardAdvertisingPage() {
  const token = getAccessToken();

  return (
    <div className="rounded-2xl border border-slate-800 bg-gradient-to-b from-ads-navy to-slate-950 p-4 shadow-xl md:p-8">
      <AdvertisingPageHeader />
      <AdsManagerPanel
        token={token}
        apiBase="/api/v1/dashboard/advertising"
        theme="dark"
        showTargeting={false}
      />
    </div>
  );
}

function AdvertisingPageHeader() {
  return (
    <header className="mb-8 border-b border-slate-700 pb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ads-teal">AdsFind</p>
      <h1 className="mt-2 text-2xl font-bold text-white">Advertising</h1>
      <p className="mt-1 text-sm text-slate-400">
        Run campaigns in AI voice conversations — same account as your Calliotel login, no separate signup.
      </p>
    </header>
  );
}