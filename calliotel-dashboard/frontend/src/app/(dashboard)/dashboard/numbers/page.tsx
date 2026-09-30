"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth";

type ActivationStatus = "inactive" | "pending" | "active";

type PhoneNumberItem = {
  id: string;
  phone_number: string;
  available: boolean;
};

type NumbersPayload = {
  numbers: PhoneNumberItem[];
  activation_status: ActivationStatus;
  assigned_number_id: string | null;
  assigned_phone_number: string | null;
  activated_at: string | null;
};

export default function NumbersPage() {
  const [data, setData] = useState<NumbersPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const load = useCallback(() => {
    const token = getAccessToken();
    if (!token) return Promise.resolve();
    return apiGet<NumbersPayload>("/api/v1/dashboard/numbers", token)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load numbers"));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onAssign(numberId: string) {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(numberId);
    setError(null);
    try {
      await apiPost("/api/v1/dashboard/numbers/assign", { number_id: numberId }, token);
      await load();
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  }

  async function onActivate() {
    const token = getAccessToken();
    if (!token) return;
    setActivating(true);
    setError(null);
    try {
      await apiPost("/api/v1/dashboard/numbers/activate", {}, token);
      await load();
      window.dispatchEvent(new Event("calliotel:tenant-updated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Activation failed");
    } finally {
      setActivating(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-600">Loading phone numbers…</p>;
  }

  if (!data) {
    return <p className="text-sm text-red-600">{error ?? "Unable to load numbers"}</p>;
  }

  const locked = data.activation_status === "active";
  const pending = data.activation_status === "pending";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-slate-900">Phone numbers</h1>
      <p className="mt-1 text-sm text-slate-600">
        Pick a number for your AI agent, then activate when you are ready to go live.
      </p>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {locked ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="text-lg font-semibold text-green-900">Agent is live</h2>
          <p className="mt-2 text-sm text-green-800">
            Your number <span className="font-semibold">{data.assigned_phone_number}</span> is
            active. The number cannot be changed after activation.
          </p>
          {data.activated_at ? (
            <p className="mt-2 text-xs text-green-700">
              Activated {new Date(data.activated_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

      {pending && data.assigned_phone_number ? (
        <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Number assigned</h2>
          <p className="mt-2 text-sm text-slate-700">
            Selected: <span className="font-semibold">{data.assigned_phone_number}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            You can pick a different available number below before activating.
          </p>
          <button
            type="button"
            disabled={activating}
            onClick={onActivate}
            className="mt-4 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {activating ? "Activating…" : "Activate Agent"}
          </button>
        </div>
      ) : null}

      {!locked ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Number</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.numbers.map((row) => {
                const isCurrent = row.id === data.assigned_number_id;
                const canAssign = row.available && !isCurrent;
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.phone_number}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {isCurrent ? (
                        <span className="text-brand-700">Your selection</span>
                      ) : row.available ? (
                        "Available"
                      ) : (
                        "In use"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canAssign ? (
                        <button
                          type="button"
                          disabled={busyId !== null}
                          onClick={() => onAssign(row.id)}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          {busyId === row.id ? "Assigning…" : pending ? "Switch" : "Assign"}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
