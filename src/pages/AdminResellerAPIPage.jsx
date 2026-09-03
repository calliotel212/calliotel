import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft, Check, X, Loader2, Key, Copy, CheckCheck, Zap, Users,
  Clock, Star, Crown, TrendingUp, RefreshCw,
} from 'lucide-react';

const API = (process.env.REACT_APP_BACKEND_URL || '') + '/api';

const ADMIN_EMAILS = new Set([
  'admin@calliotel.com', 'bigboss@calliotel.com',
  'alinmy77@gmail.com', 'worl212211@yahoo.com', 'astor539@gmail.com',
]);

const TIER_META = {
  starter: { color: '#F5A623', bg: 'rgba(245,166,35,0.15)', icon: <Zap size={13} />, label: 'Starter' },
  pro:     { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: <Star size={13} />, label: 'Pro' },
  elite:   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: <Crown size={13} />, label: 'Elite' },
};

function TierBadge({ tier }) {
  const m = TIER_META[tier] || TIER_META.starter;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
      background: m.bg, color: m.color, border: `1px solid ${m.color}40`,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
    pending:  ['#fbbf24', 'rgba(251,191,36,0.12)'],
    approved: ['#10b981', 'rgba(16,185,129,0.12)'],
    rejected: ['#ef4444', 'rgba(239,68,68,0.12)'],
  };
  const [fg, bg] = colors[status] || ['#888', 'rgba(136,136,136,0.12)'];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, background: bg, color: fg, border: `1px solid ${fg}40`,
    }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: done ? '#10b981' : 'rgba(255,255,255,0.4)', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
      {done ? <><CheckCheck size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  );
}

export default function AdminResellerAPIPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState('applications');
  const [apps, setApps] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [approveTier, setApproveTier] = useState({});
  const [filter, setFilter] = useState('pending');
  const [revealedKeys, setRevealedKeys] = useState({});

  const isAdmin = user && (
    ADMIN_EMAILS.has((user.email || '').toLowerCase()) ||
    ADMIN_EMAILS.has((user.id || '').toLowerCase())
  );

  const headers = () => ({ Authorization: `Bearer ${safeLocalStorage.getItem('token')}` });

  const loadApps = async () => {
    try {
      const r = await axios.get(`${API}/reseller-api/admin/applications`, { headers: headers() });
      setApps(r.data.applications || []);
    } catch (e) {
      toast({ title: 'Load failed', description: e?.response?.data?.detail || 'Auth?', variant: 'destructive' });
    }
  };

  const loadAccounts = async () => {
    try {
      const r = await axios.get(`${API}/reseller-api/admin/accounts`, { headers: headers() });
      setAccounts(r.data.accounts || []);
    } catch (e) {
      toast({ title: 'Load failed', description: e?.response?.data?.detail, variant: 'destructive' });
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadApps(), loadAccounts()]);
    setLoading(false);
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, []);

  const approve = async (app_id) => {
    const tier = approveTier[app_id] || 'starter';
    setBusy(app_id);
    try {
      const r = await axios.post(
        `${API}/reseller-api/admin/approve/${app_id}?tier=${tier}`,
        {}, { headers: headers() }
      );
      toast({ title: '✅ Approved!', description: `${r.data.email} — ${tier} tier. API key emailed.` });
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const reject = async (app_id, email) => {
    if (!window.confirm(`Reject application from ${email}?`)) return;
    setBusy(app_id);
    try {
      await axios.post(`${API}/reseller-api/admin/reject/${app_id}`, {}, { headers: headers() });
      toast({ title: '❌ Rejected', description: email });
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Endpoint may not exist', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const revealKey = async (reseller_id) => {
    try {
      const r = await axios.get(`${API}/reseller-api/admin/key/${reseller_id}`, { headers: headers() });
      setRevealedKeys(k => ({ ...k, [reseller_id]: r.data.api_key }));
    } catch {
      toast({ title: 'Cannot reveal key', description: 'Contact DB admin', variant: 'destructive' });
    }
  };

  const pendingCount = apps.filter(a => a.status === 'pending').length;
  const filteredApps = apps.filter(a => filter === 'all' || a.status === filter);

  if (!isAdmin) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#1a1a2e', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 16, padding: '40px 48px', textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontWeight: 700, fontSize: 18 }}>Admin only</p>
          <button onClick={() => navigate('/dashboard')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#F5A623', color: '#fff', border: 'none', cursor: 'pointer' }}>Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg,#0a0a0f 0%,#0f1020 100%)', color: '#fff', padding: '24px 20px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <button onClick={() => navigate('/admin')} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <ChevronLeft size={14} /> Admin
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>
              <Key size={20} style={{ display: 'inline', marginRight: 8, color: '#10b981' }} />
              Reseller API Management
            </h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>
              Applications · Accounts · Keys
            </p>
          </div>
          <button onClick={loadAll} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Pending Review', value: pendingCount, color: '#fbbf24', icon: <Clock size={16} /> },
            { label: 'Total Applications', value: apps.length, color: '#F5A623', icon: <Users size={16} /> },
            { label: 'Active Accounts', value: accounts.length, color: '#10b981', icon: <Key size={16} /> },
            { label: 'Auto-Approved', value: apps.filter(a => a.auto_approved).length, color: '#a855f7', icon: <Zap size={16} /> },
          ].map(s => (
            <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: s.color, marginBottom: 6 }}>{s.icon}<span style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</span></div>
              <div style={{ fontSize: 28, fontWeight: 900 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[['applications', 'Applications'], ['accounts', 'Active Accounts']].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{
              padding: '9px 20px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', border: 'none',
              background: tab === k ? '#10b981' : 'rgba(255,255,255,0.06)',
              color: tab === k ? '#fff' : 'rgba(255,255,255,0.6)',
            }}>{l}{k === 'applications' && pendingCount > 0 && <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10, fontWeight: 900 }}>{pendingCount}</span>}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.4)' }}>
            <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', display: 'block', margin: '0 auto 12px' }} />
            Loading...
            <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : tab === 'applications' ? (

          <div>
            {/* Filter */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {['pending', 'approved', 'all'].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: 'none',
                  background: filter === f ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)',
                  color: filter === f ? '#10b981' : 'rgba(255,255,255,0.5)',
                }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
              ))}
            </div>

            {filteredApps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
                No {filter} applications 🎉
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredApps.map(a => (
                  <div key={a.app_id} style={{
                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${a.status === 'pending' ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 14, padding: '18px 22px',
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>{a.company_name}</span>
                          <StatusBadge status={a.status} />
                          <TierBadge tier={a.suggested_tier || 'starter'} />
                          {a.auto_approved && <span style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', background: 'rgba(168,85,247,0.12)', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(168,85,247,0.3)' }}>⚡ Auto</span>}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                          <span>👤 {a.contact_name}</span> · <span>📧 {a.email}</span> · <span>📞 {a.phone}</span>
                        </div>
                        {a.website && <div style={{ fontSize: 12, color: '#F5A623', marginTop: 2 }}>🌐 {a.website}</div>}
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>
                          📊 {a.expected_monthly_volume} calls/mo · 🏢 {a.business_type}
                          {a.wants_white_label && ' · 🏷️ Wants white-label'}
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)', background: 'rgba(255,255,255,0.03)', borderRadius: 6, padding: '8px 10px', lineHeight: 1.5 }}>
                          💬 {a.use_case}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                          ID: {a.app_id} · {a.created_at?.slice(0, 10)}
                          {a.reseller_id && ` · Reseller: ${a.reseller_id}`}
                        </div>
                      </div>

                      {a.status === 'pending' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
                          <select
                            value={approveTier[a.app_id] || a.suggested_tier || 'starter'}
                            onChange={e => setApproveTier(t => ({ ...t, [a.app_id]: e.target.value }))}
                            style={{ padding: '8px 12px', borderRadius: 8, background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, cursor: 'pointer' }}
                          >
                            <option value="starter">Starter (10%)</option>
                            <option value="pro">Pro (15%)</option>
                            <option value="elite">Elite (20%)</option>
                          </select>
                          <button
                            onClick={() => approve(a.app_id)}
                            disabled={busy === a.app_id}
                            style={{ padding: '10px 0', borderRadius: 8, background: 'linear-gradient(135deg,#10b981,#047857)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            {busy === a.app_id ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                            Approve & Email Key
                          </button>
                          <button
                            onClick={() => reject(a.app_id, a.email)}
                            disabled={busy === a.app_id}
                            style={{ padding: '9px 0', borderRadius: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                          >
                            <X size={13} /> Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* Active Accounts Tab */
          <div>
            {accounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)', fontSize: 15 }}>
                No active reseller accounts yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {accounts.map(a => (
                  <div key={a.reseller_id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '16px 20px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 800 }}>{a.company_name}</span>
                          <TierBadge tier={a.tier} />
                          <span style={{ fontSize: 12, color: '#10b981' }}>{a.commission_pct}% commission</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                          {a.contact_name} · {a.email}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
                          ID: {a.reseller_id} · Since {a.created_at?.slice(0, 10)}
                        </div>
                        <div style={{ marginTop: 8, display: 'flex', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                          <span>💰 ${(a.stats?.total_commission_usd || 0).toFixed(2)} earned</span>
                          <span>📦 {a.stats?.total_sales || 0} sales</span>
                          <span>💵 ${(a.stats?.total_revenue_usd || 0).toFixed(2)} revenue</span>
                        </div>
                      </div>
                      <div>
                        {revealedKeys[a.reseller_id] ? (
                          <div style={{ background: '#0d1117', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontFamily: 'monospace', color: '#10b981', maxWidth: 300 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>API KEY</span>
                              <CopyBtn text={revealedKeys[a.reseller_id]} />
                            </div>
                            <span style={{ wordBreak: 'break-all' }}>{revealedKeys[a.reseller_id]}</span>
                          </div>
                        ) : (
                          <button onClick={() => revealKey(a.reseller_id)} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Key size={13} /> Reveal Key
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
