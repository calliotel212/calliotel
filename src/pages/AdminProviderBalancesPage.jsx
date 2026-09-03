import React, { useEffect, useState, useCallback } from 'react';
import { FaSync, FaExternalLinkAlt, FaCheckCircle, FaExclamationTriangle, FaQuestionCircle, FaSkull } from 'react-icons/fa';

const API_URL = process.env.REACT_APP_BACKEND_URL || '';

const STATUS_META = {
  healthy:  { icon: FaCheckCircle,        cls: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10', label: 'Healthy' },
  low:      { icon: FaExclamationTriangle, cls: 'text-amber-400 border-amber-500/40 bg-amber-500/10',     label: 'Low' },
  critical: { icon: FaSkull,               cls: 'text-red-400 border-red-500/40 bg-red-500/10',           label: 'Critical' },
  unknown:  { icon: FaQuestionCircle,      cls: 'text-zinc-400 border-zinc-500/40 bg-zinc-500/10',         label: 'Unknown' },
};

const fmt = (n, currency) => {
  if (n === null || n === undefined) return '—';
  if (currency && currency !== 'USD') return `${n.toLocaleString()} ${currency}`;
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function AdminProviderBalancesPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_URL}/api/admin/provider-balances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 403) throw new Error('Admin access only.');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setErr(e.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 120_000); // every 2 min
    return () => clearInterval(t);
  }, [load]);

  const summary = data?.summary || {};

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Provider Balances</h1>
            <p className="text-zinc-400 mt-1 text-sm">
              Real-time funding levels for every upstream provider we send money to.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50"
          >
            <FaSync className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Summary chips */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {['critical', 'low', 'healthy', 'unknown'].map((k) => {
            const meta = STATUS_META[k];
            const Icon = meta.icon;
            return (
              <div key={k} className={`border rounded-xl p-4 flex items-center gap-3 ${meta.cls}`}>
                <Icon className="text-2xl" />
                <div>
                  <div className="text-2xl font-bold">{summary[k] ?? 0}</div>
                  <div className="text-xs uppercase tracking-wide opacity-80">{meta.label}</div>
                </div>
              </div>
            );
          })}
        </div>

        {err && (
          <div className="border border-red-500/40 bg-red-500/10 text-red-300 rounded-lg p-4 mb-4">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.providers || []).map((p) => {
            const meta = STATUS_META[p.status] || STATUS_META.unknown;
            const Icon = meta.icon;
            return (
              <div key={p.name} className={`border rounded-xl p-5 ${meta.cls}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="text-lg" />
                      <h3 className="text-lg font-semibold text-white">{p.name}</h3>
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">{p.used_for}</div>
                  </div>
                  <a
                    href={p.dashboard_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-300 hover:text-white inline-flex items-center gap-1 px-2 py-1 rounded border border-white/10 hover:border-white/30"
                  >
                    Top up <FaExternalLinkAlt className="text-[10px]" />
                  </a>
                </div>

                <div className="mt-4 flex items-baseline gap-3">
                  <div className="text-3xl font-bold text-white tabular-nums">
                    {fmt(p.balance, p.currency)}
                  </div>
                  <div className="text-xs uppercase tracking-wide opacity-70">{meta.label}</div>
                </div>

                {p.note && (
                  <div className="mt-2 text-xs text-zinc-400 italic">{p.note}</div>
                )}
                {p.error && (
                  <div className="mt-2 text-xs text-red-300/90">⚠ {p.error}</div>
                )}
                {p.status !== 'unknown' && (
                  <div className="mt-3 text-[11px] text-zinc-400">
                    Low at ${p.low_threshold_usd?.toFixed?.(0)} · Critical at ${p.critical_threshold_usd?.toFixed?.(0)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data?.fetched_at && (
          <div className="mt-6 text-xs text-zinc-500 text-right">
            Last fetched: {new Date(data.fetched_at).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}
