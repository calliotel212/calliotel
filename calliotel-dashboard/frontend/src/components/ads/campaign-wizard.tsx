"use client";

import { FormEvent, type ReactNode, useMemo, useState } from "react";
import {
  emptyCampaignForm,
  MENA_COUNTRIES,
  type CampaignFormState,
} from "@/lib/campaign-types";

type Props = {
  theme?: "dark" | "light";
  loading: boolean;
  onSubmit: (form: CampaignFormState) => Promise<void>;
  onCancel: () => void;
};

export function CampaignWizard({ theme = "dark", loading, onSubmit, onCancel }: Props) {
  const [wizardStep, setWizardStep] = useState(1);
  const [form, setForm] = useState<CampaignFormState>(emptyCampaignForm);
  const [countryQuery, setCountryQuery] = useState("");

  const dark = theme === "dark";
  const inputClass = dark
    ? "w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white"
    : "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
  const labelClass = dark ? "mb-1 block text-sm text-slate-300" : "mb-1 block text-sm text-slate-600";
  const panelClass = dark
    ? "space-y-5 rounded-xl border border-slate-700 bg-ads-slate p-6"
    : "space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm";

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit(form);
    setForm(emptyCampaignForm);
    setWizardStep(1);
    setCountryQuery("");
  }

  return (
    <form onSubmit={handleSubmit} className={panelClass}>
      <StepBar step={wizardStep} dark={dark} />
      {wizardStep === 1 ? (
        <div className="space-y-4">
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>Step 1 — Creative</p>
          <FormField id="brand_name" label="Brand / campaign name" labelClass={labelClass}>
            <input
              id="brand_name"
              type="text"
              required
              className={inputClass}
              value={form.brand_name}
              onChange={(e) => setForm({ ...form, brand_name: e.target.value })}
            />
          </FormField>
          <FormField id="ad_copy" label="Ad copy" labelClass={labelClass}>
            <textarea
              id="ad_copy"
              required
              rows={3}
              className={inputClass}
              value={form.ad_copy}
              onChange={(e) => setForm({ ...form, ad_copy: e.target.value })}
            />
          </FormField>
          <FormField id="destination_url" label="Destination URL" labelClass={labelClass}>
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
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>Step 2 — Targeting</p>
          <FormField id="intent" label="Keywords / intent (for AI matching)" labelClass={labelClass}>
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
            <label className={labelClass} htmlFor="country-search">
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
            <div
              className={`max-h-40 overflow-y-auto rounded-lg border p-2 ${
                dark ? "border-slate-600 bg-ads-navy" : "border-slate-300 bg-slate-50"
              }`}
            >
              {filteredCountries.map((c) => (
                <label
                  key={c.code}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm ${
                    dark ? "text-slate-200 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-100"
                  }`}
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
            <span className={labelClass}>Languages</span>
            <div className="flex gap-3">
              {(
                [
                  ["en", "English"],
                  ["ar", "Arabic"],
                ] as const
              ).map(([code, label]) => (
                <label
                  key={code}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    dark
                      ? "border-slate-600 text-white"
                      : "border-slate-300 text-slate-800"
                  }`}
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
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>Step 3 — Budget</p>
          <FormField id="daily_budget" label="Daily budget (USD)" labelClass={labelClass}>
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
          <FormField id="max_cpc" label="Max CPC (USD)" labelClass={labelClass}>
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
            <p className="text-xs font-medium uppercase tracking-wide text-ads-teal-dark">Estimated daily reach</p>
            <p className={`mt-1 text-2xl font-semibold ${dark ? "text-white" : "text-slate-900"}`}>
              {estimatedClicks !== null ? (
                <>
                  ~{estimatedClicks.toLocaleString()}{" "}
                  <span className={`text-base font-normal ${dark ? "text-slate-300" : "text-slate-600"}`}>
                    clicks / day
                  </span>
                </>
              ) : (
                <span className={`text-base ${dark ? "text-slate-400" : "text-slate-500"}`}>
                  Enter budget and max CPC
                </span>
              )}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className={
            dark
              ? "rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300"
              : "rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600"
          }
        >
          Cancel
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={wizardStep === 1}
            onClick={() => setWizardStep((s) => Math.max(1, s - 1))}
            className={
              dark
                ? "rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 disabled:opacity-40"
                : "rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 disabled:opacity-40"
            }
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
              disabled={loading}
              className="rounded-lg bg-ads-teal px-4 py-2 text-sm font-semibold text-ads-navy disabled:opacity-60"
            >
              {loading ? "Launching…" : "Launch campaign"}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function StepBar({ step, dark }: { step: number; dark: boolean }) {
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
                  ? dark
                    ? "bg-slate-700 text-slate-200"
                    : "bg-brand-600/15 text-brand-700"
                  : dark
                    ? "bg-ads-navy text-slate-500"
                    : "bg-slate-100 text-slate-500"
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
  labelClass,
  children,
}: {
  id: string;
  label: string;
  labelClass: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}