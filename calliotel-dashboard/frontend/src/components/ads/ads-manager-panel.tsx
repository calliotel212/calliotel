"use client";

import { useCallback, useEffect, useState } from "react";
import { AdClicksChart } from "@/components/charts/ad-clicks-chart";
import { CampaignTable } from "@/components/ads/campaign-table";
import { CampaignWizard } from "@/components/ads/campaign-wizard";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Campaign, CampaignFormState } from "@/lib/campaign-types";

type Props = {
  token: string | null;
  apiBase: string;
  theme?: "dark" | "light";
  showTargeting?: boolean;
};

export function AdsManagerPanel({ token, apiBase, theme = "dark", showTargeting = true }: Props) {
  const [balance, setBalance] = useState<string>("0");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [blockedFraud, setBlockedFraud] = useState(0);

  const dark = theme === "dark";

  const refresh = useCallback(async () => {
    if (!token) return;
    const [wallet, list, shield] = await Promise.all([
      apiGet<{ balance_usd: string }>(`${apiBase}/wallet`, token),
      apiGet<Campaign[]>(`${apiBase}/campaigns`, token),
      apiGet<{ blocked_fraud_clicks: number }>(`${apiBase}/shield/stats`, token),
    ]);
    setBalance(wallet.balance_usd);
    setCampaigns(list);
    setBlockedFraud(shield.blocked_fraud_clicks);
  }, [apiBase, token]);

  useEffect(() => {
    refresh().catch(() => setError("Failed to load ads dashboard"));
  }, [refresh]);

  const hasReviewQueue = campaigns.some(
    (c) => c.status === "pending_review" || c.status === "pending_approval",
  );

  async function onDeposit() {
    if (!token) return;
    setLoadingDeposit(true);
    setError(null);
    try {
      const res = await apiPost<{ balance_usd: string }>(
        `${apiBase}/wallet/deposit`,
        { amount_usd: 100 },
        token,
      );
      setBalance(res.balance_usd);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setLoadingDeposit(false);
    }
  }

  async function onToggleStatus(c: Campaign) {
    if (!token) return;
    if (c.status === "pending_review" || c.status === "pending_approval" || c.status === "rejected") {
      return;
    }
    const next = c.status === "active" ? "paused" : "active";
    try {
      await apiPatch(`${apiBase}/campaigns/${c.id}`, { status: next }, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update campaign");
    }
  }

  async function onCreate(form: CampaignFormState) {
    if (!token) return;
    setLoadingCreate(true);
    setError(null);
    try {
      await apiPost(
        `${apiBase}/campaigns`,
        {
          brand_name: form.brand_name,
          ad_copy: form.ad_copy,
          destination_url: form.destination_url,
          intent_description: form.intent_description,
          max_cpc: Number(form.max_cpc),
          daily_budget: Number(form.daily_budget),
          target_countries: form.target_countries,
          target_languages: form.target_languages,
        },
        token,
      );
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign");
      throw err;
    } finally {
      setLoadingCreate(false);
    }
  }

  return (
    <div className="space-y-8">
      {error ? (
        <p
          className={`rounded-lg border px-4 py-2 text-sm ${
            dark ? "border-red-800 bg-red-950/50 text-red-300" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {error}
        </p>
      ) : null}

      {hasReviewQueue ? <ReviewBanner dark={dark} /> : null}

      <ShieldBadge blocked={blockedFraud} dark={dark} />

      <AdClicksChart dark={dark} />

      <section
        className={`p-6 ${dark ? "glass-panel border-slate-700" : "rounded-xl border border-slate-200 bg-white shadow-sm"}`}
      >
        <h2 className={`text-lg font-semibold ${dark ? "text-white" : "text-slate-900"}`}>Wallet</h2>
        <p className="mt-2 text-3xl font-bold text-ads-teal-dark">${balance}</p>
        <p className={`mt-1 text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Available for AI conversation placements
        </p>
        <button
          type="button"
          disabled={loadingDeposit}
          onClick={onDeposit}
          className="mt-4 rounded-lg bg-ads-teal px-4 py-2 text-sm font-semibold text-ads-navy hover:bg-ads-teal-dark disabled:opacity-60"
        >
          {loadingDeposit ? "Depositing…" : "Deposit Funds ($100 mock)"}
        </button>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className={`text-lg font-semibold ${dark ? "text-white" : "text-slate-900"}`}>
            Ads Manager
          </h2>
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="rounded-lg border border-ads-teal px-4 py-2 text-sm font-medium text-ads-teal-dark hover:bg-ads-teal/10"
          >
            {showCreate ? "Cancel" : "Create campaign"}
          </button>
        </div>

        {showCreate ? (
          <div className="mb-6">
            <CampaignWizard
              theme={theme}
              loading={loadingCreate}
              onSubmit={onCreate}
              onCancel={() => setShowCreate(false)}
            />
          </div>
        ) : null}

        <CampaignTable
          campaigns={campaigns}
          theme={theme}
          showTargeting={showTargeting}
          onToggleStatus={onToggleStatus}
        />
      </section>
    </div>
  );
}

function ShieldBadge({ blocked, dark }: { blocked: number; dark: boolean }) {
  return (
    <section
      className={`rounded-xl border px-5 py-4 ${
        dark
          ? "border-teal-700/40 bg-gradient-to-r from-teal-950/50 to-ads-slate"
          : "border-teal-200 bg-teal-50"
      }`}
    >
      <p className={`text-sm font-semibold ${dark ? "text-teal-100" : "text-teal-900"}`}>
        Protected by AdsFind Shield
      </p>
      <p className={`mt-1 text-sm ${dark ? "text-slate-300" : "text-teal-800"}`}>
        {blocked === 0
          ? "Duplicate click protection is active — no bot clicks blocked yet."
          : `${blocked.toLocaleString()} bot click${blocked === 1 ? "" : "s"} blocked.`}
      </p>
    </section>
  );
}

function ReviewBanner({ dark }: { dark: boolean }) {
  return (
    <section
      className={`rounded-xl border px-5 py-4 ${
        dark
          ? "border-amber-700/40 bg-gradient-to-r from-amber-950/60 to-ads-slate"
          : "border-amber-200 bg-amber-50"
      }`}
    >
      <p className={`text-sm font-semibold ${dark ? "text-amber-100" : "text-amber-900"}`}>
        48-hour standard review
      </p>
      <p className={`mt-1 text-sm ${dark ? "text-slate-300" : "text-amber-800"}`}>
        New campaigns stay in review for up to 48 hours. We verify your business details, then ads go live
        automatically unless flagged.
      </p>
    </section>
  );
}