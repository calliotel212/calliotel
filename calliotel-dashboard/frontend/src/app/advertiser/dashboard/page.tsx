"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdvertiserDashboardShell } from "@/components/advertiser-dashboard-shell";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { getAdvertiserAccessToken } from "@/lib/advertiser-auth";

type Campaign = {
  id: string;
  brand_name: string;
  max_cpc: string;
  status: string;
  ad_copy: string;
  destination_url: string;
  intent_description: string;
};

type Wallet = { balance_usd: string };

const emptyForm = {
  brand_name: "",
  ad_copy: "",
  destination_url: "",
  intent_description: "",
  max_cpc: "1.00",
};

export default function AdvertiserDashboardPage() {
  const [balance, setBalance] = useState<string>("0");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);

  const token = getAdvertiserAccessToken();

  const refresh = useCallback(async () => {
    const t = getAdvertiserAccessToken();
    if (!t) return;
    const [wallet, list] = await Promise.all([
      apiGet<Wallet>("/api/v1/advertisers/wallet", t),
      apiGet<Campaign[]>("/api/v1/advertisers/campaigns", t),
    ]);
    setBalance(wallet.balance_usd);
    setCampaigns(list);
  }, []);

  useEffect(() => {
    refresh().catch(() => setError("Failed to load dashboard"));
  }, [refresh]);

  async function onDeposit() {
    if (!token) return;
    setLoadingDeposit(true);
    setError(null);
    try {
      const res = await apiPost<{ balance_usd: string }>(
        "/api/v1/advertisers/wallet/deposit",
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

  async function onPause(id: string) {
    if (!token) return;
    try {
      await apiPatch(`/api/v1/advertisers/campaigns/${id}`, { status: "paused" }, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not pause campaign");
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setLoadingCreate(true);
    setError(null);
    try {
      await apiPost(
        "/api/v1/advertisers/campaigns",
        {
          ...form,
          max_cpc: Number(form.max_cpc),
          status: "active",
        },
        token,
      );
      setForm(emptyForm);
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign");
    } finally {
      setLoadingCreate(false);
    }
  }

  return (
    <AdvertiserDashboardShell>
      <div className="space-y-8">
        {error ? (
          <p className="rounded-lg border border-red-800 bg-red-950/50 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-slate-700 bg-ads-slate p-6">
          <h2 className="text-lg font-semibold text-white">Wallet</h2>
          <p className="mt-2 text-3xl font-bold text-ads-teal">${balance}</p>
          <p className="mt-1 text-sm text-slate-400">Available for AI conversation placements</p>
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
            <h2 className="text-lg font-semibold text-white">Campaigns</h2>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className="rounded-lg border border-ads-teal px-4 py-2 text-sm font-medium text-ads-teal hover:bg-ads-teal/10"
            >
              {showCreate ? "Cancel" : "Create campaign"}
            </button>
          </div>

          {showCreate ? (
            <form
              onSubmit={onCreate}
              className="mb-6 space-y-4 rounded-xl border border-slate-700 bg-ads-slate p-6"
            >
              {(
                [
                  ["brand_name", "Brand name", "text"],
                  ["destination_url", "Destination URL", "url"],
                  ["max_cpc", "Max CPC (USD)", "number"],
                ] as const
              ).map(([key, label, type]) => (
                <div key={key}>
                  <label className="mb-1 block text-sm text-slate-300" htmlFor={key}>
                    {label}
                  </label>
                  <input
                    id={key}
                    type={type}
                    required
                    step={key === "max_cpc" ? "0.01" : undefined}
                    min={key === "max_cpc" ? "0.01" : undefined}
                    className="w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-sm text-slate-300" htmlFor="ad_copy">
                  Ad copy
                </label>
                <textarea
                  id="ad_copy"
                  required
                  rows={3}
                  className="w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white"
                  value={form.ad_copy}
                  onChange={(e) => setForm({ ...form, ad_copy: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-slate-300" htmlFor="intent">
                  Keywords / intent
                </label>
                <textarea
                  id="intent"
                  required
                  rows={2}
                  className="w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white"
                  value={form.intent_description}
                  onChange={(e) => setForm({ ...form, intent_description: e.target.value })}
                />
              </div>
              <button
                type="submit"
                disabled={loadingCreate}
                className="rounded-lg bg-ads-teal px-4 py-2 text-sm font-semibold text-ads-navy disabled:opacity-60"
              >
                {loadingCreate ? "Saving…" : "Launch campaign"}
              </button>
            </form>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-ads-slate text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Brand</th>
                  <th className="px-4 py-3 font-medium">Max CPC</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No campaigns yet. Create one to appear in AI conversations.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className="px-4 py-3 font-medium text-white">{c.brand_name}</td>
                      <td className="px-4 py-3 text-slate-300">${c.max_cpc}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            c.status === "active"
                              ? "bg-teal-900/50 text-ads-teal"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.status === "active" ? (
                          <button
                            type="button"
                            onClick={() => onPause(c.id)}
                            className="text-sm text-ads-teal hover:underline"
                          >
                            Pause
                          </button>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdvertiserDashboardShell>
  );
}