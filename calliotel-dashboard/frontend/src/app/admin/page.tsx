"use client";

import { FormEvent, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import {
  clearAdminAccessToken,
  getAdminAccessToken,
  setAdminAccessToken,
} from "@/lib/admin-auth";
import { AdminOverviewCharts } from "@/components/charts/admin-overview-charts";

type Tab = "overview" | "kyc" | "campaigns" | "publishers";

type Metrics = {
  total_revenue_usd: string;
  total_served: number;
  valid_clicks: number;
  blocked_fraud_clicks: number;
  total_clicks: number;
  revenue_formula: string;
};

type Advertiser = {
  id: string;
  user_id: string;
  email: string;
  name: string;
  business_name: string | null;
  phone_number: string | null;
  website_url: string | null;
  kyc_status: string;
  wallet_balance: string;
  campaign_count: number;
};

type Publisher = {
  id: string;
  name: string;
  pending_balance: string;
  paid_balance: string;
  user_count: number;
  impressions: number;
};

type Campaign = {
  id: string;
  advertiser_id: string;
  advertiser_name: string;
  brand_name: string;
  status: string;
  max_cpc: string;
  daily_budget: string;
  clicks: number;
  review_ends_at?: string | null;
};

function statusBadge(status: string) {
  const base = "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide";
  switch (status) {
    case "pending_review":
    case "pending_approval":
      return `${base} bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40`;
    case "active":
      return `${base} bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40`;
    case "rejected":
      return `${base} bg-red-500/20 text-red-300 ring-1 ring-red-500/40`;
    case "paused":
      return `${base} bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-500/40`;
    case "approved":
      return `${base} bg-teal-500/20 text-teal-200 ring-1 ring-teal-500/40`;
    case "unverified":
      return `${base} bg-zinc-600/30 text-zinc-300 ring-1 ring-zinc-600/40`;
    default:
      return `${base} bg-zinc-700 text-zinc-200`;
  }
}

export default function AdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [kycFilter, setKycFilter] = useState<string>("needs_action");

  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [advertisers, setAdvertisers] = useState<Advertiser[]>([]);
  const [publishers, setPublishers] = useState<Publisher[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    setToken(getAdminAccessToken());
  }, []);

  const loadConsole = useCallback(async (t: string) => {
    const [m, adv, pub, camps] = await Promise.all([
      apiGet<Metrics>("/api/v1/admin/metrics", t),
      apiGet<Advertiser[]>("/api/v1/admin/advertisers", t),
      apiGet<Publisher[]>("/api/v1/admin/publishers", t),
      apiGet<Campaign[]>("/api/v1/admin/campaigns", t),
    ]);
    setMetrics(m);
    setAdvertisers(adv);
    setPublishers(pub);
    setCampaigns(camps);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadConsole(token).catch(() => {
      clearAdminAccessToken();
      setToken(null);
      setError("Session expired. Sign in again.");
    });
  }, [token, loadConsole]);

  const kycQueue = useMemo(
    () => advertisers.filter((a) => a.kyc_status === "unverified" || a.kyc_status === "in_review"),
    [advertisers],
  );

  const filteredKyc = useMemo(() => {
    if (kycFilter === "all") return advertisers;
    if (kycFilter === "approved") return advertisers.filter((a) => a.kyc_status === "approved");
    if (kycFilter === "rejected") return advertisers.filter((a) => a.kyc_status === "rejected");
    return kycQueue;
  }, [advertisers, kycFilter, kycQueue]);

  const pendingCampaigns = useMemo(
    () => campaigns.filter((c) => c.status === "pending_review" || c.status === "pending_approval"),
    [campaigns],
  );

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await apiPost<{ access_token: string }>("/api/v1/admin/login", {
        secret,
        email: email.trim() || undefined,
      });
      setAdminAccessToken(res.access_token);
      setToken(res.access_token);
      setSecret("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function moderateCampaign(campaignId: string, action: "approve" | "reject") {
    if (!token) return;
    setActionId(campaignId);
    setError(null);
    try {
      await apiPost(`/api/v1/admin/campaigns/${campaignId}/${action}`, {}, token);
      await loadConsole(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionId(null);
    }
  }

  async function patchCampaign(campaignId: string, status: "active" | "paused") {
    if (!token) return;
    setActionId(campaignId);
    try {
      await apiPatch(`/api/v1/admin/campaigns/${campaignId}`, { status }, token);
      await loadConsole(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActionId(null);
    }
  }

  async function moderateKyc(advertiserId: string, action: "approve" | "reject") {
    if (!token) return;
    setActionId(advertiserId);
    setError(null);
    try {
      await apiPost(`/api/v1/admin/advertisers/${advertiserId}/kyc/${action}`, {}, token);
      await loadConsole(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "KYC action failed");
    } finally {
      setActionId(null);
    }
  }

  function logout() {
    clearAdminAccessToken();
    setToken(null);
    setMetrics(null);
    setAdvertisers([]);
    setPublishers([]);
    setCampaigns([]);
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
        <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-b from-slate-900 to-slate-950 p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-400">Platform admin</p>
          <h1 className="mt-2 text-2xl font-bold text-white">AdsFind console</h1>
          <p className="mt-2 text-sm text-slate-400">Owner access only. Not linked from the public site.</p>
          <form onSubmit={onLogin} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400" htmlFor="admin-email">
                Email (if ADMIN_EMAILS is set)
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400" htmlFor="admin-secret">
                Admin secret
              </label>
              <input
                id="admin-secret"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Enter console"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: "Overview" },
    { id: "kyc", label: "Advertisers (KYC)", count: kycQueue.length + pendingCampaigns.length },
    { id: "campaigns", label: "Campaigns" },
    { id: "publishers", label: "Publishers" },
  ];

  return (
    <main className="min-h-screen bg-ads-navy text-slate-100">
      <header className="border-b border-slate-800 bg-ads-slate/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-ads-teal">AdsFind ops</p>
            <h1 className="text-2xl font-bold text-white">Admin console</h1>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            Sign out
          </button>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-0 sm:px-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === t.id
                  ? "border-ads-teal text-white"
                  : "border-transparent text-slate-500 hover:text-slate-200"
              }`}
            >
              {t.label}
              {t.count != null && t.count > 0 ? (
                <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  {t.count}
                </span>
              ) : null}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {error ? (
          <p className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
            {error}
          </p>
        ) : null}

        {tab === "overview" && metrics ? (
          <>
            <AdminOverviewCharts metrics={metrics} />
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Est. revenue" value={`$${Number(metrics.total_revenue_usd).toFixed(2)}`} />
              <StatCard label="Served events" value={metrics.total_served.toLocaleString()} />
              <StatCard label="Valid clicks" value={metrics.valid_clicks.toLocaleString()} />
              <StatCard
                label="Blocked fraud clicks"
                value={metrics.blocked_fraud_clicks.toLocaleString()}
                highlight
              />
              <StatCard label="Advertisers" value={String(advertisers.length)} />
              <StatCard label="Pending reviews" value={String(pendingCampaigns.length)} />
            </section>
          </>
        ) : null}

        {tab === "kyc" ? (
          <div className="space-y-10">
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">Advertiser KYC</h2>
                <div className="flex gap-2">
                  {[
                    { id: "needs_action", label: "Needs action" },
                    { id: "all", label: "All" },
                    { id: "approved", label: "Approved" },
                    { id: "rejected", label: "Rejected" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setKycFilter(f.id)}
                      className={`rounded-md px-3 py-1 text-xs font-medium ${
                        kycFilter === f.id
                          ? "bg-teal-600 text-white"
                          : "bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <DataTable
                headers={["Business", "Contact", "Website", "KYC", "Wallet", "Actions"]}
                empty="No advertisers in this filter"
                rows={filteredKyc.map((a) => (
                  <tr key={a.id} className="border-t border-slate-800/80 hover:bg-slate-900/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{a.business_name || a.name}</p>
                      <p className="text-xs text-slate-500">{a.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">{a.phone_number || "—"}</td>
                    <td className="px-4 py-3">
                      {a.website_url ? (
                        <a
                          href={a.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-teal-400 hover:underline"
                        >
                          {a.website_url.replace(/^https?:\/\//, "").slice(0, 40)}
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={statusBadge(a.kyc_status)}>{a.kyc_status}</span>
                    </td>
                    <td className="px-4 py-3 text-emerald-400">${Number(a.wallet_balance).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      {a.kyc_status === "unverified" || a.kyc_status === "in_review" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={actionId === a.id}
                            onClick={() => moderateKyc(a.id, "approve")}
                            className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={actionId === a.id}
                            onClick={() => moderateKyc(a.id, "reject")}
                            className="rounded-md border border-red-800 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              />
            </section>

            <section>
              <h2 className="mb-4 text-lg font-semibold text-white">Campaigns in 48h review</h2>
              <DataTable
                headers={["Brand", "Advertiser", "Status", "Ends review", "Actions"]}
                empty="No campaigns awaiting review"
                rows={pendingCampaigns.map((c) => (
                  <tr key={c.id} className="border-t border-slate-800/80 hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-medium text-white">{c.brand_name}</td>
                    <td className="px-4 py-3 text-slate-400">{c.advertiser_name}</td>
                    <td className="px-4 py-3">
                      <span className={statusBadge(c.status)}>{c.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {c.review_ends_at
                        ? new Date(c.review_ends_at).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={actionId === c.id}
                          onClick={() => moderateCampaign(c.id, "approve")}
                          className="rounded-md bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                        >
                          Approve now
                        </button>
                        <button
                          type="button"
                          disabled={actionId === c.id}
                          onClick={() => moderateCampaign(c.id, "reject")}
                          className="rounded-md border border-red-800 px-3 py-1 text-xs font-semibold text-red-300 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              />
            </section>
          </div>
        ) : null}

        {tab === "campaigns" ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">All campaigns</h2>
            <DataTable
              headers={["Brand", "Advertiser", "Status", "Budget", "CPC", "Clicks", "Ops"]}
              empty="No campaigns"
              rows={campaigns.map((c) => (
                <tr key={c.id} className="border-t border-slate-800/80 hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-medium text-white">{c.brand_name}</td>
                  <td className="px-4 py-3 text-slate-400">{c.advertiser_name}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadge(c.status)}>{c.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">${Number(c.daily_budget).toFixed(2)}/d</td>
                  <td className="px-4 py-3 text-slate-300">${c.max_cpc}</td>
                  <td className="px-4 py-3 text-slate-300">{c.clicks}</td>
                  <td className="px-4 py-3">
                    {c.status === "active" ? (
                      <button
                        type="button"
                        disabled={actionId === c.id}
                        onClick={() => patchCampaign(c.id, "paused")}
                        className="text-xs font-medium text-amber-300 hover:underline disabled:opacity-50"
                      >
                        Pause
                      </button>
                    ) : c.status === "paused" ? (
                      <button
                        type="button"
                        disabled={actionId === c.id}
                        onClick={() => patchCampaign(c.id, "active")}
                        className="text-xs font-medium text-emerald-300 hover:underline disabled:opacity-50"
                      >
                        Activate
                      </button>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              ))}
            />
          </section>
        ) : null}

        {tab === "publishers" ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold text-white">Publisher partners</h2>
            <DataTable
              headers={["Name", "Pending", "Paid", "Users", "Impressions"]}
              empty="No publishers"
              rows={publishers.map((p) => (
                <tr key={p.id} className="border-t border-slate-800/80 hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                  <td className="px-4 py-3 text-amber-300">${Number(p.pending_balance).toFixed(2)}</td>
                  <td className="px-4 py-3 text-emerald-400">${Number(p.paid_balance).toFixed(2)}</td>
                  <td className="px-4 py-3 text-slate-400">{p.user_count}</td>
                  <td className="px-4 py-3 text-slate-400">{p.impressions}</td>
                </tr>
              ))}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`glass-panel p-6 ${
        highlight ? "border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-slate-900/60" : ""
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: ReactNode[];
  empty: string;
}) {
  return (
    <div className="glass-panel overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase text-slate-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-10 text-center text-slate-600">
                {empty}
              </td>
            </tr>
          ) : (
            rows
          )}
        </tbody>
      </table>
    </div>
  );
}