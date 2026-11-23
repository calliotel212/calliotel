"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  clearAdminAccessToken,
  getAdminAccessToken,
  setAdminAccessToken,
} from "@/lib/admin-auth";

type Metrics = {
  total_revenue_usd: string;
  total_clicks: number;
  revenue_formula: string;
};

type Advertiser = {
  id: string;
  name: string;
  wallet_balance: string;
  user_count: number;
  campaign_count: number;
};

type Publisher = {
  id: string;
  business_name: string | null;
  activation_status: string;
  agent_status: string;
  user_count: number;
  phone_number: string | null;
};

type Campaign = {
  id: string;
  advertiser_name: string;
  brand_name: string;
  status: string;
  max_cpc: string;
  daily_budget: string;
  clicks: number;
};

function statusBadge(status: string) {
  const base = "rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide";
  switch (status) {
    case "pending_approval":
      return `${base} bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40`;
    case "active":
      return `${base} bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40`;
    case "rejected":
      return `${base} bg-red-500/20 text-red-300 ring-1 ring-red-500/40`;
    case "paused":
      return `${base} bg-zinc-500/20 text-zinc-300 ring-1 ring-zinc-500/40`;
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

  async function moderate(campaignId: string, action: "approve" | "reject") {
    if (!token) return;
    setActionId(campaignId);
    setError(null);
    try {
      await apiPost(
        `/api/v1/admin/campaigns/${campaignId}/${action}`,
        {},
        token,
      );
      await loadConsole(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
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
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-b from-zinc-900 to-zinc-950 p-8 shadow-2xl shadow-violet-950/40">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-400">
            God mode
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white">Platform console</h1>
          <p className="mt-2 text-sm text-zinc-400">Owner access only. Not linked from the public site.</p>
          <form onSubmit={onLogin} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="admin-email">
                Email (if ADMIN_EMAILS is set)
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-400" htmlFor="admin-secret">
                Admin secret
              </label>
              <input
                id="admin-secret"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
            </div>
            {error ? (
              <p className="text-sm text-red-400">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Enter console"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-400">Ops</p>
          <h1 className="text-3xl font-bold text-white">God-mode dashboard</h1>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          Sign out
        </button>
      </header>

      {error ? (
        <p className="mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {metrics ? (
        <section className="mb-10 grid gap-4 sm:grid-cols-2">
          <StatCard
            label="Est. revenue (USD)"
            value={`$${Number(metrics.total_revenue_usd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            hint={metrics.revenue_formula}
          />
          <StatCard
            label="Total clicks (served)"
            value={metrics.total_clicks.toLocaleString()}
            hint="Count of ad_events where event_type = served"
          />
        </section>
      ) : null}

      <section className="mb-10">
        <SectionTitle title="Campaign approval" />
        <DataTable
          headers={["Brand", "Advertiser", "Status", "Budget", "CPC", "Clicks", "Actions"]}
          empty="No campaigns"
          rows={campaigns.map((c) => (
            <tr key={c.id} className="border-t border-zinc-800/80 hover:bg-zinc-900/40">
              <td className="px-4 py-3 font-medium text-white">{c.brand_name}</td>
              <td className="px-4 py-3 text-zinc-400">{c.advertiser_name}</td>
              <td className="px-4 py-3">
                <span className={statusBadge(c.status)}>{c.status.replace("_", " ")}</span>
              </td>
              <td className="px-4 py-3 text-zinc-300">${Number(c.daily_budget).toFixed(2)}/d</td>
              <td className="px-4 py-3 text-zinc-300">${c.max_cpc}</td>
              <td className="px-4 py-3 text-zinc-300">{c.clicks}</td>
              <td className="px-4 py-3">
                {c.status === "pending_approval" ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionId === c.id}
                      onClick={() => moderate(c.id, "approve")}
                      className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actionId === c.id}
                      onClick={() => moderate(c.id, "reject")}
                      className="rounded-md border border-red-800 px-3 py-1 text-xs font-semibold text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-500">—</span>
                )}
              </td>
            </tr>
          ))}
        />
      </section>

      <div className="mb-10 grid gap-10 lg:grid-cols-2">
        <div>
          <SectionTitle title="Advertisers" />
          <DataTable
            headers={["Business", "Wallet", "Users", "Campaigns"]}
            empty="No advertisers"
            rows={advertisers.map((a) => (
              <tr key={a.id} className="border-t border-zinc-800/80">
                <td className="px-4 py-3 font-medium text-white">{a.name}</td>
                <td className="px-4 py-3 text-emerald-400">${Number(a.wallet_balance).toFixed(2)}</td>
                <td className="px-4 py-3 text-zinc-400">{a.user_count}</td>
                <td className="px-4 py-3 text-zinc-400">{a.campaign_count}</td>
              </tr>
            ))}
          />
        </div>
        <div>
          <SectionTitle title="Publishers (tenants)" />
          <DataTable
            headers={["Business", "Activation", "Agent", "Users", "Number"]}
            empty="No tenants"
            rows={publishers.map((p) => (
              <tr key={p.id} className="border-t border-zinc-800/80">
                <td className="px-4 py-3 font-medium text-white">{p.business_name ?? "—"}</td>
                <td className="px-4 py-3 text-zinc-400">{p.activation_status}</td>
                <td className="px-4 py-3 text-zinc-400">{p.agent_status}</td>
                <td className="px-4 py-3 text-zinc-400">{p.user_count}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.phone_number ?? "—"}</td>
              </tr>
            ))}
          />
        </div>
      </div>
    </main>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-white">{value}</p>
      <p className="mt-3 text-xs leading-relaxed text-zinc-500">{hint}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h2 className="mb-4 text-lg font-semibold text-zinc-200">{title}</h2>;
}

function DataTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: React.ReactNode[];
  empty: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
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
              <td colSpan={headers.length} className="px-4 py-10 text-center text-zinc-600">
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
