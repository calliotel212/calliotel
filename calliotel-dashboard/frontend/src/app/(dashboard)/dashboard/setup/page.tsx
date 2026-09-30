"use client";

import { FormEvent, useEffect, useState } from "react";
import { apiGet, apiPut } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type DayHours = { open: string; close: string; closed: boolean };

type SetupData = {
  business_name: string | null;
  business_type: string | null;
  business_hours: Record<string, DayHours>;
  business_services: string | null;
  business_faq: string | null;
  preferred_language: "en" | "ar";
  agent_voice: "female" | "male";
};

const DAYS: { key: string; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const BUSINESS_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "salon", label: "Salon" },
  { value: "clinic", label: "Clinic" },
  { value: "real_estate", label: "Real estate" },
  { value: "other", label: "Other" },
];

const emptySetup = (): SetupData => ({
  business_name: "",
  business_type: null,
  business_hours: Object.fromEntries(
    DAYS.map((d) => [d.key, { open: "09:00", close: "17:00", closed: false }]),
  ),
  business_services: "",
  business_faq: "",
  preferred_language: "en",
  agent_voice: "female",
});

export default function SetupPage() {
  const [form, setForm] = useState<SetupData>(emptySetup());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    apiGet<SetupData>("/api/v1/dashboard/setup", token)
      .then((data) => {
        setForm({
          ...data,
          business_name: data.business_name ?? "",
          business_services: data.business_services ?? "",
          business_faq: data.business_faq ?? "",
          business_hours: data.business_hours ?? emptySetup().business_hours,
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token) return;
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      await apiPut(
        "/api/v1/dashboard/setup",
        {
          ...form,
          business_name: form.business_name?.trim() || null,
          business_services: form.business_services || null,
          business_faq: form.business_faq || null,
        },
        token,
      );
      setToast("Business setup saved.");
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
      setTimeout(() => setToast(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function updateDay(key: string, patch: Partial<DayHours>) {
    setForm((prev) => ({
      ...prev,
      business_hours: {
        ...prev.business_hours,
        [key]: { ...prev.business_hours[key], ...patch },
      },
    }));
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading setup…</p>;
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Business setup</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tell your AI agent about your business. This name appears in your dashboard header.
      </p>

      {toast ? (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {toast}
        </div>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      <form className="mt-6 space-y-6" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_name">
            Business name
          </label>
          <input
            id="business_name"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_name ?? ""}
            onChange={(e) => setForm({ ...form, business_name: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="business_type">
            Business type
          </label>
          <select
            id="business_type"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_type ?? ""}
            onChange={(e) =>
              setForm({ ...form, business_type: e.target.value || null })
            }
          >
            <option value="">Select type…</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Hours of operation</legend>
          <div className="mt-3 space-y-2">
            {DAYS.map(({ key, label }) => {
              const day = form.business_hours[key];
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="w-24 text-sm font-medium text-slate-700">{label}</span>
                  <label className="flex items-center gap-1 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={day.closed}
                      onChange={(e) => updateDay(key, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.open}
                    onChange={(e) => updateDay(key, { open: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="time"
                    disabled={day.closed}
                    value={day.close}
                    onChange={(e) => updateDay(key, { close: e.target.value })}
                    className="rounded border border-slate-300 px-2 py-1 text-sm disabled:opacity-50"
                  />
                </div>
              );
            })}
          </div>
        </fieldset>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="services">
            Services / menu
          </label>
          <textarea
            id="services"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_services ?? ""}
            onChange={(e) => setForm({ ...form, business_services: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="faq">
            FAQ
          </label>
          <textarea
            id="faq"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={form.business_faq ?? ""}
            onChange={(e) => setForm({ ...form, business_faq: e.target.value })}
          />
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Preferred language</legend>
          <div className="mt-2 flex gap-4">
            {[
              { value: "en", label: "English" },
              { value: "ar", label: "Arabic" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="preferred_language"
                  checked={form.preferred_language === opt.value}
                  onChange={() =>
                    setForm({ ...form, preferred_language: opt.value as "en" | "ar" })
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">Agent voice</legend>
          <div className="mt-2 flex gap-4">
            {[
              { value: "female", label: "Female" },
              { value: "male", label: "Male" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="agent_voice"
                  checked={form.agent_voice === opt.value}
                  onChange={() =>
                    setForm({ ...form, agent_voice: opt.value as "female" | "male" })
                  }
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
