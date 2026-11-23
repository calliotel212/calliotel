"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { AdvertiserDashboardShell } from "@/components/advertiser-dashboard-shell";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { getAdvertiserAccessToken } from "@/lib/advertiser-auth";

type Campaign = {
  id: string;
  brand_name: string;
  max_cpc: string;
  daily_budget: string;
  target_countries: string[];
  target_languages: string[];
  status: string;
  ad_copy: string;
  destination_url: string;
  intent_description: string;
  clicks: number;
};

type Wallet = { balance_usd: string };

const MENA_COUNTRIES: { code: string; name: string }[] = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "EG", name: "Egypt" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "IQ", name: "Iraq" },
  { code: "MA", name: "Morocco" },
  { code: "DZ", name: "Algeria" },
  { code: "TN", name: "Tunisia" },
  { code: "YE", name: "Yemen" },
  { code: "PS", name: "Palestine" },
  { code: "LY", name: "Libya" },
  { code: "SD", name: "Sudan" },
];

const emptyForm = {
  brand_name: "",
  ad_copy: "",
  destination_url: "",
  intent_description: "",
  max_cpc: "1.00",
  daily_budget: "25",
  target_countries: [] as string[],
  target_languages: [] as string[],
};

function targetingSummary(c: Campaign): string {
  const parts: string[] = [];
  if (c.target_countries?.length) {
    parts.push(c.target_countries.join(", "));
  } else {
    parts.push("All countries");
  }
  if (c.target_languages?.length) {
    parts.push(c.target_languages.map((l) => l.toUpperCase()).join(", "));
  } else {
    parts.push("All languages");
  }
  return parts.join(" · ");
}

export default function AdvertiserDashboardPage() {
  const [balance, setBalance] = useState<string>("0");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [countryQuery, setCountryQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingDeposit, setLoadingDeposit] = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);

  const token = getAdvertiserAccessToken();

  const filteredCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    if (!q) return MENA_COUNTRIES;
    return MENA_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    );
  }, [countryQuery]);

  const estimatedClicks = useMemo(() => {
    const budget = Number(form.daily_budget);
    const cpc = Number(form.max_cpc);
    if (!budget || !cpc || cpc <= 0) return null;
    return Math.floor(budget / cpc);
  }, [form.daily_budget, form.max_cpc]);

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

  function resetWizard() {
    setForm(emptyForm);
    setWizardStep(1);
    setCountryQuery("");
  }

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

  function statusLabel(status: string): string {
    if (status === "pending_approval") return "Pending review";
    if (status === "rejected") return "Rejected";
    if (status === "active") return "Active";
    if (status === "paused") return "Paused";
    return status;
  }

  async function onToggleStatus(c: Campaign) {
    if (!token) return;
    if (c.status === "pending_approval" || c.status === "rejected") return;
    const next = c.status === "active" ? "paused" : "active";
    try {
      await apiPatch(`/api/v1/advertisers/campaigns/${c.id}`, { status: next }, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update campaign");
    }
  }

  function toggleCountry(code: string) {
    setForm((prev) => {
      const has = prev.target_countries.includes(code);
      return {
        ...prev,
        target_countries: has
          ? prev.target_countries.filter((x) => x !== code)
          : [...prev.target_countries, code],
      };
    });
  }

  function toggleLanguage(lang: "en" | "ar") {
    setForm((prev) => {
      const has = prev.target_languages.includes(lang);
      return {
        ...prev,
        target_languages: has
          ? prev.target_languages.filter((x) => x !== lang)
          : [...prev.target_languages, lang],
      };
    });
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
      resetWizard();
      setShowCreate(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create campaign");
    } finally {
      setLoadingCreate(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white";

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
            <h2 className="text-lg font-semibold text-white">Ads Manager</h2>
            <button
              type="button"
              onClick={() => {
                if (showCreate) resetWizard();
                setShowCreate((v) => !v);
              }}
              className="rounded-lg border border-ads-teal px-4 py-2 text-sm font-medium text-ads-teal hover:bg-ads-teal/10"
            >
              {showCreate ? "Cancel" : "Create campaign"}
            </button>
          </div>

          {showCreate ? (
            <form
              onSubmit={onCreate}
              className="mb-6 space-y-5 rounded-xl border border-slate-700 bg-ads-slate p-6"
            >
              <StepBar step={wizardStep} />
              {wizardStep === 1 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">Step 1 — Creative</p>
                  <FormField id="brand_name" label="Brand / campaign name">
                    <input
                      id="brand_name"
                      type="text"
                      required
                      className={inputClass}
                      value={form.brand_name}
                      onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
                    />
                  </FormField>
                  <FormField id="ad_copy" label="Ad copy">
                    <textarea
                      id="ad_copy"
                      required
                      rows={3}
                      className={inputClass}
                      value={form.ad_copy}
                      onChange={(e) => setForm({ ...form, ad_copy: e.target.value })}
                    />
                  </FormField>
                  <FormField id="destination_url" label="Destination URL">
                    <input
                      id="destination_url"
                      type="url"
                      required
                      className={inputClass}
                      value={form.destination_url}
                      onChange={(e) => setForm({ ...form, destination_url: e.target.value })}
                    />
                  </FormField>
                </div>
              ) : null}

              {wizardStep === 2 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">Step 2 — Targeting</p>
                  <FormField id="intent" label="Keywords / intent (for AI matching)">
                    <textarea
                      id="intent"
                      required
                      rows={2}
                      className={inputClass}
                      value={form.intent_description}
                      onChange={(e) => setForm({ ...form, intent_description: e.target.value })}
                    />
                  </FormField>
                  <div>
                    <label className="mb-1 block text-sm text-slate-300" htmlFor="country-search">
                      MENA countries (leave empty = all)
                    </label>
                    <input
                      id="country-search"
                      type="search"
                      placeholder="Search countries…"
                      className={`${inputClass} mb-2`}
                      value={countryQuery}
                      onChange={(e) => setCountryQuery(e.target.value)}
                    />
                    <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-600 bg-ads-navy p-2">
                      {filteredCountries.map((c) => (
                        <label
                          key={c.code}
                          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-slate-200 hover:bg-slate-800"
                        >
                          <input
                            type="checkbox"
                            checked={form.target_countries.includes(c.code)}
                            onChange={() => toggleCountry(c.code)}
                            className="accent-ads-teal"
                          />
                          {c.name} ({c.code})
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="mb-2 block text-sm text-slate-300">Languages</span>
                    <div className="flex gap-3">
                      {(
                        [
                          ["en", "English"],
                          ["ar", "Arabic"],
                        ] as const
                      ).map(([code, label]) => (
                        <label
                          key={code}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-white"
                        >
                          <input
                            type="checkbox"
                            checked={form.target_languages.includes(code)}
                            onChange={() => toggleLanguage(code)}
                            className="accent-ads-teal"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {wizardStep === 3 ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-400">Step 3 — Budget</p>
                  <FormField id="daily_budget" label="Daily budget (USD)">
                    <input
                      id="daily_budget"
                      type="number"
                      required
                      min="1"
                      step="0.01"
                      className={inputClass}
                      value={form.daily_budget}
                      onChange={(e) => setForm({ ...form, daily_budget: e.target.value })}
                    />
                  </FormField>
                  <FormField id="max_cpc" label="Max CPC (USD)">
                    <input
                      id="max_cpc"
                      type="number"
                      required
                      step="0.01"
                      min="0.01"
                      className={inputClass}
                      value={form.max_cpc}
                      onChange={(e) => setForm({ ...form, max_cpc: e.target.value })}
                    />
                  </FormField>
                  <div className="rounded-lg border border-ads-teal/40 bg-ads-teal/10 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-ads-teal">
                      Estimated daily reach
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {estimatedClicks !== null ? (
                        <>
                          ~{estimatedClicks.toLocaleString()}{" "}
                          <span className="text-base font-normal text-slate-300">clicks / day</span>
                        </>
                      ) : (
                        <span className="text-base text-slate-400">Enter budget and max CPC</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Formula: daily budget ÷ max CPC (estimated clicks, not guaranteed impressions).
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  disabled={wizardStep === 1}
                  onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
                >
                  Back
                </button>
                {wizardStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((s) => s + 1)}
                    className="rounded-lg bg-ads-teal px-4 py-2 text-sm font-semibold text-ads-navy"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loadingCreate}
                    className="rounded-lg bg-ads-teal px-4 py-2 text-sm font-semibold text-ads-navy disabled:opacity-60"
                  >
                    {loadingCreate ? "Launching…" : "Launch campaign"}
                  </button>
                )}
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 bg-ads-slate text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Campaign</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Budget</th>
                  <th className="px-4 py-3 font-medium">CPC</th>
                  <th className="px-4 py-3 font-medium">Targeting</th>
                  <th className="px-4 py-3 font-medium">Clicks</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                      No campaigns yet. Create one to appear in AI conversations.
                    </td>
                  </tr>
                ) : (
                  campaigns.map((c) => (
                    <tr key={c.id} className="border-t border-slate-800">
                      <td className="px-4 py-3 font-medium text-white">{c.brand_name}</td>
                      <td className="px-4 py-3">
                        {c.status === "pending_approval" || c.status === "rejected" ? (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              c.status === "pending_approval"
                                ? "bg-amber-900/40 text-amber-200"
                                : "bg-red-900/40 text-red-200"
                            }`}
                          >
                            {statusLabel(c.status)}
                          </span>
                        ) : (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={c.status === "active"}
                            onClick={() => onToggleStatus(c)}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                              c.status === "active"
                                ? "bg-teal-900/50 text-ads-teal hover:bg-teal-900/70"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                          >
                            {statusLabel(c.status)}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        ${Number(c.daily_budget || 0).toFixed(2)}/day
                      </td>
                      <td className="px-4 py-3 text-slate-300">${c.max_cpc}</td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-slate-400" title={targetingSummary(c)}>
                        {targetingSummary(c)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{c.clicks ?? 0}</td>
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

function StepBar({ step }: { step: number }) {
  const labels = ["Creative", "Targeting", "Budget"];
  return (
    <div className="flex gap-2">
      {labels.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div
            key={label}
            className={`flex-1 rounded-md py-2 text-center text-xs font-medium ${
              active
                ? "bg-ads-teal text-ads-navy"
                : done
                  ? "bg-slate-700 text-slate-200"
                  : "bg-ads-navy text-slate-500"
            }`}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-slate-300" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}