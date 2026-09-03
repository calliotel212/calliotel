import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShoppingBag, GitBranch, Bell, Mail,
  MessageSquare, Phone, LogOut, RefreshCw, Search, ChevronLeft,
  ChevronRight, DollarSign, UserPlus, TrendingUp, Activity,
  ExternalLink, Check, Zap, Send, Reply, Lock, Inbox,
  AlertCircle, Bitcoin, Eye, Ban, CreditCard, Calendar,
  Hash, Globe, X, Plus, Minus,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  BarChart, Bar,
} from 'recharts';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL || '';
const ADMIN_EMAILS = new Set([
  'admin@calliotel.com', 'bigboss@calliotel.com',
  'alinmy77@gmail.com', 'worl212211@yahoo.com', 'astor539@gmail.com',
  'g_agroup2@yahoo.com',
]);

const Y = '#f5c518';   // yellow accent

const api = async (path, opts = {}) => {
  const t = localStorage.getItem('token');
  const r = await fetch(`${API}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}`, ...(opts.headers || {}) },
  });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || `HTTP ${r.status}`);
  return r.json();
};

const fmtMoney = (n) => `$${(Number(n) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtNum   = (n) => (Number(n) || 0).toLocaleString();
const fmtDate  = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso || '—'; } };
const fmtAgo   = (iso) => {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
};

// ─── DESIGN TOKENS ──────────────────────────────────────────────────────────
const BG   = 'bg-[#0d1117]';
const SIDE = 'bg-[#161b22]';
const CARD = 'bg-[#1c2333]';
const BORD = 'border-[#30363d]';
const TXT  = 'text-[#e6edf3]';
const SUB  = 'text-[#8b949e]';

// ─── NAV ────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'overview',       label: 'Overview',       icon: LayoutDashboard },
  { id: 'users',          label: 'Users',           icon: Users },
  { id: 'purchases',      label: 'Purchases',       icon: ShoppingBag },
  { id: 'referrals',      label: 'Referrals',       icon: GitBranch },
  { id: 'notifications',  label: 'Notifications',   icon: Bell },
  { id: 'email-blast',    label: 'Email Blast',     icon: Mail },
  { id: 'tickets',        label: 'Tickets',         icon: MessageSquare, badge: true },
  { id: 'numbers',        label: 'Numbers',         icon: Phone },
  { id: 'proxy',          label: 'Proxy',           icon: Globe },
];

// ─── SIDEBAR ────────────────────────────────────────────────────────────────
function Sidebar({ section, onChange, onLogout, collapsed, onToggle, openTickets }) {
  return (
    <aside className={`${collapsed ? 'w-16' : 'w-52'} flex-shrink-0 ${SIDE} flex flex-col h-screen sticky top-0 border-r ${BORD} transition-all duration-200 z-30`}>
      <div className={`flex items-center gap-3 px-4 py-5 border-b ${BORD}`}>
        <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center font-black text-black text-sm" style={{ background: Y }}>C</div>
        {!collapsed && (
          <div className="min-w-0">
            <div className={`font-bold text-sm ${TXT} leading-tight`}>Calliotel</div>
            <div className="text-[10px] text-[#8b949e] uppercase tracking-wider">Admin Panel</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 overflow-y-auto">
        {NAV.map(item => {
          const Icon = item.icon;
          const active = section === item.id;
          const showBadge = item.badge && openTickets > 0;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all relative
                ${active
                  ? `${TXT} font-semibold`
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5'
                }`}
            >
              {active && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full" style={{ background: Y }} />}
              <Icon className="w-4 h-4 flex-shrink-0" style={active ? { color: Y } : {}} />
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && showBadge && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold text-black" style={{ background: Y }}>{openTickets}</span>
              )}
              {collapsed && showBadge && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full" style={{ background: Y }} />
              )}
            </button>
          );
        })}
      </nav>

      <div className={`border-t ${BORD} p-3 space-y-1`}>
        <button
          onClick={onToggle}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#8b949e] hover:text-[#e6edf3] text-sm transition-all hover:bg-white/5`}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[#8b949e] hover:text-red-400 text-sm transition-all hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

// ─── STAT CARD ───────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className={`${CARD} rounded-xl border ${BORD} p-5 flex items-start justify-between`}>
      <div>
        <div className="text-[11px] uppercase tracking-wider text-[#8b949e] font-semibold mb-1">{label}</div>
        <div className={`text-2xl font-bold ${TXT}`}>{value ?? '—'}</div>
        {sub && <div className="text-xs text-[#8b949e] mt-1">{sub}</div>}
      </div>
      {Icon && (
        <div className="w-9 h-9 rounded-lg flex items-center justify-center opacity-70" style={{ background: accent || 'rgba(245,197,24,0.15)' }}>
          <Icon className="w-5 h-5" style={{ color: accent ? '#fff' : Y }} />
        </div>
      )}
    </div>
  );
}

// ─── OVERVIEW ────────────────────────────────────────────────────────────────
function Overview({ dash, onGoTo }) {
  if (!dash) return <div className="p-8 text-[#8b949e] text-sm">Loading dashboard…</div>;
  const d = dash;
  const now = new Date();

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Users"        value={fmtNum(d.total_users)}      sub={`+${fmtNum(d.new_today)} today`}             icon={Users}       />
        <StatCard label="New This Month"     value={fmtNum(d.new_this_month || d.new_today)}  sub={`+${fmtNum(d.new_today)} today`} icon={UserPlus}    />
        <StatCard label="Total Revenue"      value={fmtMoney(d.total_revenue)}  sub="$0.00 today"                                 icon={DollarSign}  />
        <StatCard label="Revenue This Month" value={fmtMoney(d.monthly_revenue)} sub="$0.00 this week"                            icon={TrendingUp}  />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Credits Granted (Total)" value={fmtNum(d.total_credits || 0)} sub={`${fmtNum(d.today_transactions || 0)} today`} icon={CreditCard} />
        <StatCard label="Total Referrals"    value={fmtNum(d.referrals || 0)}    sub="0 bonuses paid"                             icon={GitBranch}   />
        <StatCard label="Dedicated Numbers"  value={fmtNum(d.active_numbers || 0)} sub={`${fmtNum(d.pool_available || 0)} pool available`} icon={Phone} />
        <StatCard label="eSIM Orders Today"   value={fmtNum(d.esim_today || 0)}   sub="Credit events today"                       icon={MessageSquare} />
      </div>

      {(d.pending_crypto > 0) && (
        <div className="rounded-xl border p-5" style={{ borderColor: 'rgba(245,197,24,0.4)', background: 'rgba(245,197,24,0.05)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-bold" style={{ color: Y }}>PENDING CRYPTO ORDERS</div>
              <div className="text-xs text-[#8b949e]">{d.pending_crypto} awaiting TRC20 confirmation</div>
            </div>
            <button onClick={() => onGoTo('purchases')} className="px-4 py-2 rounded-lg text-sm font-bold text-black transition-all hover:opacity-90" style={{ background: Y }}>
              Reconcile Now
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={`${CARD} rounded-xl border ${BORD} p-5`}>
          <div className={`text-sm font-semibold ${TXT} mb-4`}>New Signups — Last 30 Days</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={d.signup_chart || []}>
              <defs>
                <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={Y} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={Y} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#1c2333', border: '1px solid #30363d', borderRadius: 8, color: '#e6edf3', fontSize: 12 }} />
              <Area type="monotone" dataKey="count" stroke={Y} strokeWidth={2} fill="url(#sg)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className={`${CARD} rounded-xl border ${BORD} p-5`}>
          <div className={`text-sm font-semibold ${TXT} mb-4`}>Daily Revenue ($) — Last 30 Days</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={d.rev_chart || []}>
              <XAxis dataKey="date" tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Revenue']} contentStyle={{ background: '#1c2333', border: '1px solid #30363d', borderRadius: 8, color: '#e6edf3', fontSize: 12 }} />
              <Bar dataKey="revenue" fill={Y} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {d.traffic_by_source?.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${CARD} rounded-xl border ${BORD} p-5`}>
            <div className={`text-sm font-semibold ${TXT} mb-3`}>Acquisition — Last 30 Days</div>
            <div className="text-xs text-[#8b949e] mb-3">By Source (utm_source)</div>
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase text-[#8b949e]">
                <th className="text-left pb-2">Bucket</th>
                <th className="text-right pb-2">Signups</th>
                <th className="text-right pb-2">Paid</th>
                <th className="text-right pb-2">Revenue</th>
              </tr></thead>
              <tbody className={TXT}>
                {(d.traffic_by_source || []).slice(0, 8).map((r, i) => (
                  <tr key={i} className={`border-t ${BORD}`}>
                    <td className="py-1.5 font-mono text-xs">{r.bucket}</td>
                    <td className="py-1.5 text-right">{r.signups}</td>
                    <td className="py-1.5 text-right">{r.paid}</td>
                    <td className="py-1.5 text-right">{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={`${CARD} rounded-xl border ${BORD} p-5`}>
            <div className={`text-sm font-semibold ${TXT} mb-3`}>By Country (IP-resolved)</div>
            <table className="w-full text-sm">
              <thead><tr className="text-[11px] uppercase text-[#8b949e]">
                <th className="text-left pb-2">Bucket</th>
                <th className="text-right pb-2">Signups</th>
                <th className="text-right pb-2">Paid</th>
                <th className="text-right pb-2">Revenue</th>
              </tr></thead>
              <tbody className={TXT}>
                {(d.traffic_by_country || []).slice(0, 8).map((r, i) => (
                  <tr key={i} className={`border-t ${BORD}`}>
                    <td className="py-1.5 font-mono text-xs">{r.bucket}</td>
                    <td className="py-1.5 text-right">{r.signups}</td>
                    <td className="py-1.5 text-right">{r.paid}</td>
                    <td className="py-1.5 text-right">{fmtMoney(r.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── USERS ───────────────────────────────────────────────────────────────────
function UsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api('/api/admin/users/list?limit=500')
      .then(d => setUsers(d.users || []))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }, []);

  const addCredits = async (userId, amount) => {
    try {
      await api(`/api/admin/users/${encodeURIComponent(userId)}/credits`, {
        method: 'POST', body: JSON.stringify({ amount, reason: 'Admin credit' }),
      });
      toast.success(`Added $${amount} to ${userId}`);
    } catch (e) { toast.error(e.message); }
  };

  const filtered = users.filter(u =>
    !q || (u.email || u.id || '').toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className={`text-xs ${SUB} mb-4`}>{fmtNum(users.length)} total accounts — click any row to see full history</div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e]" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search email or ID…"
          className={`w-full pl-9 pr-4 py-2.5 rounded-lg ${CARD} border ${BORD} text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518] transition-colors`} />
      </div>
      <div className={`${CARD} rounded-xl border ${BORD} overflow-hidden`}>
        <table className="w-full text-sm">
          <thead>
            <tr className={`border-b ${BORD} text-[11px] uppercase text-[#8b949e]`}>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-right px-4 py-3">Balance</th>
              <th className="text-right px-4 py-3">Referrals</th>
              <th className="text-right px-4 py-3">Purchased</th>
              <th className="text-center px-4 py-3">Warn Email</th>
              <th className="text-right px-4 py-3">Joined</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="py-12 text-center text-[#8b949e]">Loading…</td></tr>
            )}
            {!loading && filtered.slice(0, 200).map((u, i) => (
              <React.Fragment key={u.email || u.id || i}>
                <tr
                  onClick={() => setSelected(selected === (u.email || u.id) ? null : (u.email || u.id))}
                  className={`border-t ${BORD} cursor-pointer transition-colors ${selected === (u.email || u.id) ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}
                >
                  <td className="px-4 py-3">
                    <div className={`text-sm font-medium ${TXT} truncate max-w-[200px]`}>{u.email}</div>
                    <div className="text-[10px] text-[#8b949e] font-mono truncate max-w-[200px]">{u.id?.slice(0,20)}…</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: Y }}>{fmtMoney(u.wallet_balance || 0)}</td>
                  <td className="px-4 py-3 text-right text-[#8b949e]">{u.referral_count || 0}</td>
                  <td className="px-4 py-3 text-right text-[#8b949e]">{u.number_count || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${u.warn_email ? 'text-yellow-400 bg-yellow-400/10' : 'text-[#8b949e] bg-white/5'}`}>
                      {u.warn_email ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[#8b949e] text-xs">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-xs text-[#8b949e] hover:text-white cursor-pointer">View →</span>
                  </td>
                </tr>
                {selected === (u.email || u.id) && (
                  <tr className={`border-t ${BORD}`}>
                    <td colSpan={7} className="px-6 py-4 bg-white/[0.02]">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="text-xs text-[#8b949e]"><span className="text-[#e6edf3]">Email verified:</span> {u.email_verified ? '✅' : '❌'}</div>
                        <div className="text-xs text-[#8b949e]"><span className="text-[#e6edf3]">Auth:</span> {u.auth_provider || 'email'}</div>
                        <div className="text-xs text-[#8b949e]"><span className="text-[#e6edf3]">Banned:</span> {u.banned ? '⛔ Yes' : 'No'}</div>
                        <div className="flex gap-2 ml-auto">
                          <button onClick={() => addCredits(u.email || u.id, 5)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-black transition-all hover:opacity-80" style={{ background: Y }}>+$5 Credit</button>
                          <button onClick={() => addCredits(u.email || u.id, 10)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-black transition-all hover:opacity-80" style={{ background: Y }}>+$10 Credit</button>
                          <a href={`/admin/user/${u.email || u.id}`} target="_blank" rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#e6edf3] border border-[#30363d] hover:bg-white/5 flex items-center gap-1">
                            <Eye className="w-3 h-3" /> Full Profile
                          </a>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── PURCHASES ───────────────────────────────────────────────────────────────
function PurchasesPanel() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState({});
  const [granting, setGranting] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const d = await api('/api/admin/crypto/pending?limit=100');
      setOrders(d.orders || []);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const forceGrant = async (paymentId) => {
    if (!window.confirm(`Force-grant credits for payment ${paymentId}?`)) return;
    setGranting(g => ({ ...g, [paymentId]: true }));
    try {
      const r = await api(`/api/admin/crypto/${paymentId}/force-grant`, { method: 'POST' });
      toast.success(`✅ Granted ${fmtMoney(r.credits)} to ${r.user_id}`);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setGranting(g => ({ ...g, [paymentId]: false })); }
  };

  const checkStatus = async (paymentId) => {
    setChecking(c => ({ ...c, [paymentId]: true }));
    try {
      const r = await api(`/api/payments/nowpayments/status/${paymentId}`);
      toast.info(`Status: ${r.payment_status || r.status || 'unknown'}`);
    } catch (e) { toast.error(e.message); }
    finally { setChecking(c => ({ ...c, [paymentId]: false })); }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className={`text-base font-bold ${TXT}`}>Pending Crypto Orders ({orders.length} awaiting confirmation)</h2>
          <div className={`text-xs ${SUB} mt-0.5`}>
            ● Check — scans blockchain live for the exact USDT/TRC20 amount &nbsp;·&nbsp;
            ● Force Grant — manually grant credits <em>only</em> if you confirmed payment yourself
          </div>
        </div>
        <div className="flex gap-2">
          <a href="https://tronscan.org" target="_blank" rel="noreferrer" className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${SUB} border ${BORD} hover:bg-white/5`}>
            TronScan <ExternalLink className="w-3 h-3" />
          </a>
          <button onClick={load} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${SUB} border ${BORD} hover:bg-white/5`}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className={`${CARD} rounded-xl border ${BORD} p-12 text-center text-[#8b949e]`}>Loading…</div>
      ) : orders.length === 0 ? (
        <div className={`${CARD} rounded-xl border ${BORD} p-12 text-center`}>
          <Check className="w-10 h-10 mx-auto mb-3 text-green-500 opacity-60" />
          <div className={`text-sm ${TXT}`}>No pending orders</div>
          <div className={`text-xs ${SUB} mt-1`}>All crypto payments have been confirmed</div>
        </div>
      ) : (
        <div className={`${CARD} rounded-xl border ${BORD} overflow-hidden`}>
          {orders.map((o, i) => {
            const pid = o.payment_id || o._id;
            return (
              <div key={pid || i} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? `border-t ${BORD}` : ''}`}>
                <Bitcoin className="w-5 h-5 flex-shrink-0 text-[#8b949e]" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[#8b949e] truncate">{pid}</span>
                    {o.pay_currency && <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-black`} style={{ background: Y }}>{o.pay_currency?.toUpperCase()}</span>}
                    {o.price_amount && <span className="text-xs text-[#8b949e]">{o.credits || o.price_amount} credits</span>}
                  </div>
                  <div className={`text-sm ${TXT} mt-0.5 truncate`}>{o.user_id || o.email}</div>
                  {o.status && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-amber-400">⚠ {fmtAgo(o.created_at)}</span>
                      <span className="text-[10px] text-[#8b949e]">Likely abandoned</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => checkStatus(pid)}
                    disabled={checking[pid]}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border ${BORD} text-[#e6edf3] hover:bg-white/10 disabled:opacity-50`}
                  >
                    {checking[pid] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />} Check
                  </button>
                  <button
                    onClick={() => forceGrant(pid)}
                    disabled={granting[pid]}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-black disabled:opacity-50"
                    style={{ background: Y }}
                  >
                    {granting[pid] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />} Force Grant
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── REFERRALS ───────────────────────────────────────────────────────────────
function ReferralsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/referrals/admin/users/pending?limit=200')
      .then(d => setData(d))
      .catch(() => api('/api/admin/traffic').then(d => setData({ referrals: [] })).catch(() => setData({ referrals: [] })))
      .finally(() => setLoading(false));
  }, []);

  const rows = (data?.users || data?.referrals || []);
  const total = data?.total || rows.length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <div className={`text-xs ${SUB}`}>{fmtNum(total)} total referral links</div>
        <div className="flex gap-4 text-sm">
          <div className={`${CARD} rounded-lg border ${BORD} px-4 py-2 text-center`}>
            <div className="font-bold text-xl" style={{ color: Y }}>{fmtNum(total)}</div>
            <div className={`text-[10px] ${SUB}`}>Total</div>
          </div>
          <div className={`${CARD} rounded-lg border ${BORD} px-4 py-2 text-center`}>
            <div className="font-bold text-xl text-[#e6edf3]">0</div>
            <div className={`text-[10px] ${SUB}`}>Bonuses Paid</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`${CARD} rounded-xl border ${BORD} p-12 text-center text-[#8b949e]`}>Loading…</div>
      ) : rows.length === 0 ? (
        <div className={`${CARD} rounded-xl border ${BORD} p-12 text-center text-[#8b949e] text-sm`}>No referral data available</div>
      ) : (
        <div className={`${CARD} rounded-xl border ${BORD} overflow-hidden`}>
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${BORD} text-[11px] uppercase text-[#8b949e]`}>
                <th className="text-left px-4 py-3">Referrer</th>
                <th className="text-left px-4 py-3">Referred User</th>
                <th className="text-left px-4 py-3">Bonus Paid</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 100).map((r, i) => (
                <tr key={i} className={`border-t ${BORD} hover:bg-white/[0.03]`}>
                  <td className="px-4 py-3">
                    <div className={`text-sm truncate max-w-[180px] ${TXT}`}>{r.referrer_email || r.email || '—'}</div>
                    <div className={`text-[10px] font-mono ${SUB} truncate max-w-[180px]`}>{r.referrer_id || r.user_id || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-sm truncate max-w-[180px] ${TXT}`}>{r.referred_email || r.referred_user_email || '—'}</div>
                    <div className={`text-[10px] font-mono ${SUB} truncate max-w-[180px]`}>{r.referred_id || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-[#8b949e]">Pending</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8b949e]">{fmtDate(r.created_at || r.joined_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
const PUSH_TEMPLATES = [
  { label: '100K USA + 80K Canada Launch', title: '🚀 100K USA Numbers Available!', body: 'We just added 100K USA and 80K Canada numbers. Grab yours now before they sell out!' },
  { label: 'Conversion Nudge — unused credit', title: '💰 You Have Unused Credit', body: "You still have credit in your wallet! Get a virtual number from just $1.19/mo." },
  { label: 'Urgency — limited numbers', title: '⚡ Limited Numbers Remaining', body: 'USA & Canada numbers are going fast. Lock in yours before stock runs out.' },
  { label: 'Weekend promo reminder', title: '🎉 Weekend Deal — Save 40%!', body: 'This weekend only: annual plans at 40% off. More savings, more features.' },
  { label: 'Proxy launch nudge', title: '🌐 Calliotel Proxy Now Live', body: 'Browse anonymously with our new proxy service. Try it free with your account.' },
];

function NotificationsPanel() {
  const [tab, setTab] = useState('inapp');
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  const [link, setLink] = useState('');
  const [type, setType] = useState('info');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState([]);
  const [pushStats, setPushStats] = useState(null);
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody]   = useState('');
  const [pushUrl, setPushUrl]     = useState('/');
  const [pushSending, setPushSending] = useState(false);

  useEffect(() => {
    api('/api/admin/push/stats').then(d => { setPushStats(d); setSent(d.recent_broadcasts || []); }).catch(() => null);
  }, []);

  const applyTemplate = (tpl) => { setPushTitle(tpl.title); setPushBody(tpl.body); };

  const sendInApp = async () => {
    if (!title.trim() || !msg.trim()) { toast.error('Title and message required'); return; }
    setSending(true);
    try {
      await api('/api/admin/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title, message: msg, link, type }),
      });
      toast.success('Sent to all users!');
      setTitle(''); setMsg(''); setLink('');
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) { toast.error('Title and body required'); return; }
    if (!window.confirm(`Send push to ALL ${pushStats?.active_subscribers || '?'} subscribers?`)) return;
    setPushSending(true);
    try {
      const r = await api('/api/admin/push/broadcast', {
        method: 'POST',
        body: JSON.stringify({ title: pushTitle, body: pushBody, url: pushUrl }),
      });
      toast.success(`✅ Sent to ${r.sent} subscribers`);
      setPushTitle(''); setPushBody(''); setPushUrl('/');
      api('/api/admin/push/stats').then(d => { setPushStats(d); setSent(d.recent_broadcasts || []); }).catch(() => null);
    } catch (e) { toast.error(e.message); }
    finally { setPushSending(false); }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className={`text-lg font-bold ${TXT} mb-1`}>📢 Broadcast Center</h1>
      <p className={`text-xs ${SUB} mb-5`}>Send in-app notifications or push blasts to all users.</p>

      <div className={`flex gap-1 ${CARD} rounded-lg p-1 mb-6 w-fit border ${BORD}`}>
        {[['inapp','🔔 In-App Notifications'], ['push','📲 Web Push']].map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === id ? 'text-black font-bold' : `${SUB} hover:text-white`}`}
            style={tab === id ? { background: Y } : {}}
          >{lbl}</button>
        ))}
      </div>

      {tab === 'inapp' && (
        <>
          <div className={`${CARD} rounded-xl border ${BORD} p-5 mb-5`}>
            <div className={`text-sm font-semibold ${TXT} mb-3`}>⚡ Quick Nudge Shortcuts</div>
            <div className="flex flex-wrap gap-2">
              {PUSH_TEMPLATES.slice(0,5).map(t => (
                <button key={t.label} onClick={() => applyTemplate(t)}
                  className={`px-3 py-1.5 rounded-lg border ${BORD} text-xs ${SUB} hover:text-white hover:bg-white/5 transition-all`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className={`${CARD} rounded-xl border ${BORD} p-5 space-y-4`}>
            <div className={`text-sm font-semibold ${TXT}`}>🖊 Compose Notification</div>
            <div>
              <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>TITLE *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. 🎉 20% off today only!"
                className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518]`} />
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>TYPE</label>
                <select value={type} onChange={e => setType(e.target.value)}
                  className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} focus:outline-none focus:border-[#f5c518]`}>
                  {['info','success','warning','promo'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>MESSAGE *</label>
              <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={3} placeholder="Write your message here. Keep it short and clear."
                className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518] resize-none`} />
            </div>
            <div>
              <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>LINK (OPTIONAL)</label>
              <input value={link} onChange={e => setLink(e.target.value)} placeholder="e.g. /pricing or https://…"
                className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518]`} />
              <div className={`text-[10px] ${SUB} mt-1`}>If set, a "View →" button will appear on the notification.</div>
            </div>
            <button onClick={sendInApp} disabled={sending}
              className="w-full py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: Y }}>
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send to All Users
            </button>
          </div>

          {sent.length > 0 && (
            <div className={`${CARD} rounded-xl border ${BORD} p-5 mt-5`}>
              <div className={`text-sm font-semibold ${TXT} mb-3`}>📋 Sent Notifications ({sent.length})</div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {sent.map((n, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${BORD} bg-white/[0.02]`}>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${TXT} truncate`}>{n.title}</div>
                      <div className={`text-xs ${SUB} truncate`}>{n.body || n.message}</div>
                      {n.url && <div className="text-[10px] text-blue-400 truncate">{n.url}</div>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold text-black" style={{ background: n.active !== false ? Y : '#8b949e' }}>
                        {n.active !== false ? 'Active' : 'Off'}
                      </span>
                      <div className={`text-[10px] ${SUB} mt-1`}>{fmtAgo(n.sent_at || n.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'push' && (
        <div className={`${CARD} rounded-xl border ${BORD} p-5 space-y-4`}>
          {pushStats && (
            <div className={`text-xs ${SUB}`}>{pushStats.active_subscribers} active push subscribers · {pushStats.broadcasts_sent} broadcasts sent</div>
          )}
          <div>
            <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>TITLE</label>
            <input value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="Push notification title"
              className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518]`} />
          </div>
          <div>
            <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>BODY</label>
            <textarea value={pushBody} onChange={e => setPushBody(e.target.value)} rows={3}
              className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518] resize-none`} />
          </div>
          <div>
            <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>LINK</label>
            <input value={pushUrl} onChange={e => setPushUrl(e.target.value)}
              className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} focus:outline-none focus:border-[#f5c518]`} />
          </div>
          <button onClick={sendPush} disabled={pushSending}
            className="w-full py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: Y }}>
            {pushSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Send Push to All Subscribers
          </button>
        </div>
      )}
    </div>
  );
}

// ─── EMAIL BLAST ─────────────────────────────────────────────────────────────
const EMAIL_TEMPLATES = [
  { label: '100K USA + 80K Canada Numbers', subject: '🚀 Big Update: 100,000+ US & 80,000+ Canada Numbers Now Live — Calliotel',
    body: `<div style="font-size:32px;margin-bottom:14px">🚀</div>\n<h1 style="margin:0 0 10px;font-size:24px;font-weight:900;color:#FFD600">Massive Inventory Update</h1>\n<p>Hi {{name}} — we just added <strong>over 100,000 new numbers</strong> across the United States and Canada. Getting a verified phone number has never been faster.</p>` },
  { label: 'Proxy Launch', subject: '🌐 Calliotel Proxy is Live — Browse Anonymously Now', body: '<p>Hi {{name}}, our brand-new proxy service is now live! Browse the web anonymously with your Calliotel account.</p>' },
  { label: 'Credit Promo', subject: '💰 Special Credit Bonus — This Week Only', body: '<p>Hi {{name}}, we\'re running a limited credit promotion. Add funds this week and get a bonus.</p>' },
  { label: 'Custom Announcement', subject: '📣 Important Announcement from Calliotel', body: '<p>Hi {{name}},</p><p>We have an important update for you…</p>' },
];

function EmailBlastPanel() {
  const [subject, setSubject] = useState('');
  const [body, setBody]       = useState('');
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState(null);
  const [fireInApp, setFireInApp] = useState(false);

  const applyTemplate = (tpl) => { setSubject(tpl.subject); setBody(tpl.body); setPreview(false); };

  const send = async () => {
    if (!subject.trim() || !body.trim()) { toast.error('Subject and body required'); return; }
    if (!window.confirm('Send this email to ALL users? This cannot be undone.')) return;
    setSending(true);
    try {
      const r = await api('/api/admin/email/broadcast', {
        method: 'POST', body: JSON.stringify({ subject, body }),
      });
      setResult(r);
      toast.success(`✅ Email sent to ${r.sent} users`);
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className={`text-lg font-bold ${TXT} mb-1`}>📧 Email Blast</h1>
      <p className={`text-xs ${SUB} mb-5`}>Write an email and send it to everyone who has an account. Use <code className="text-yellow-400">{'{{name}}'}</code> anywhere — it gets replaced with each user's name.</p>

      <div className={`${CARD} rounded-xl border ${BORD} p-5 mb-5`}>
        <div className={`text-sm font-semibold ${TXT} mb-3`}>⚡ Quick Templates</div>
        <div className="flex flex-wrap gap-2">
          {EMAIL_TEMPLATES.map(t => (
            <button key={t.label} onClick={() => applyTemplate(t)}
              className={`px-3 py-1.5 rounded-lg border ${BORD} text-xs ${SUB} hover:text-white hover:bg-white/5 transition-all`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${CARD} rounded-xl border ${BORD} p-5 space-y-4`}>
        <div className={`text-sm font-semibold ${TXT}`}>🖊 Compose Email</div>
        <div>
          <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold block mb-1.5`}>EMAIL SUBJECT *</label>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518]`} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={`text-[11px] uppercase tracking-wider ${SUB} font-semibold`}>EMAIL BODY (HTML) *</label>
            <button onClick={() => setPreview(p => !p)} className={`text-[11px] px-2.5 py-1 rounded-lg border ${BORD} ${SUB} hover:text-white`}>
              {preview ? '✏ Edit' : '👁 Preview'}
            </button>
          </div>
          {preview ? (
            <div className="rounded-lg border border-[#f5c518]/30 bg-white p-4 min-h-[160px] text-sm" dangerouslySetInnerHTML={{ __html: body.replace(/\{\{name\}\}/g, 'John') }} />
          ) : (
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
              className={`w-full rounded-lg ${BG} border ${BORD} px-3 py-2.5 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518] resize-none font-mono`} />
          )}
          <div className={`text-[10px] ${SUB} mt-1`}>The body wraps in our branded email template automatically. Preview uses "John" as a sample name.</div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={fireInApp} onChange={e => setFireInApp(e.target.checked)} className="rounded" />
          <span className={`text-xs ${SUB}`}>🔔 Also fire an in-app notification at the same time</span>
        </label>
        {result && <div className="p-3 rounded-lg text-sm font-semibold text-green-400 bg-green-400/10 border border-green-400/20">✅ Sent to {result.sent} users · {result.failed} failed · {result.total_users} total</div>}
        <div className="flex items-center justify-between">
          <div className={`text-[11px] ${SUB}`}>Sends in batches — may take a minute for large lists</div>
          <button onClick={send} disabled={sending}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center gap-2 hover:opacity-90"
            style={{ background: Y }}>
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Email Blast
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TICKETS ─────────────────────────────────────────────────────────────────
function TicketsPanel() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [selected, setSelected] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);

  const load = async (f = filter) => {
    setLoading(true);
    try {
      const q = f === 'all' ? '' : `?status=${f}&limit=100`;
      const d = await api(`/api/support/admin/tickets${q}&limit=100`);
      setTickets(d.tickets || []);
    } catch { toast.error('Failed to load tickets'); }
    finally { setLoading(false); }
  };

  const loadTicket = async (id) => {
    try { setSelected(await api(`/api/support/admin/tickets/${id}`)); }
    catch { toast.error('Failed to load ticket'); }
  };

  const sendReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    try {
      await api(`/api/support/admin/tickets/${selected.id}/reply`, {
        method: 'POST', body: JSON.stringify({ message: replyText, is_internal: isInternal }),
      });
      toast.success('Reply sent!');
      setReplyText('');
      await loadTicket(selected.id);
      await load();
    } catch (e) { toast.error(e.message); }
    finally { setSending(false); }
  };

  const setStatus = async (id, status) => {
    try {
      await api(`/api/support/admin/tickets/${id}/status?status=${status}`, { method: 'PUT' });
      toast.success(`Marked ${status}`);
      setSelected(null);
      await load();
    } catch (e) { toast.error(e.message); }
  };

  useEffect(() => { load(filter); }, [filter]);

  return (
    <div className="flex h-full min-h-screen">
      {/* List */}
      <div className={`w-80 flex-shrink-0 border-r ${BORD} flex flex-col`}>
        <div className={`px-4 py-3 border-b ${BORD}`}>
          <h2 className={`text-sm font-bold ${TXT} mb-2`}>Support Tickets</h2>
          <div className="flex gap-1">
            {['open','answered','closed','all'].map(s => (
              <button key={s} onClick={() => { setFilter(s); setSelected(null); }}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all ${filter === s ? 'text-black font-bold' : `${SUB} hover:text-white hover:bg-white/5`}`}
                style={filter === s ? { background: Y } : {}}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-[#8b949e] text-sm">Loading…</div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <Inbox className="w-8 h-8 text-[#8b949e] mx-auto mb-2 opacity-50" />
              <div className="text-sm text-[#8b949e]">No tickets</div>
            </div>
          ) : tickets.map(t => (
            <button key={t.id} onClick={() => loadTicket(t.id)}
              className={`w-full text-left px-4 py-4 border-b ${BORD} transition-colors ${selected?.id === t.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white ${
                  (t.status||'')==='closed' ? 'bg-gray-600' : (t.status||'')==='answered' || (t.status||'')==='in_progress' ? 'bg-amber-600' : 'bg-green-600'
                }`}>{(t.status||'open').toUpperCase()}</span>
                {(t.status==='open') && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold text-[#f5c518] bg-[#f5c518]/10">Needs reply</span>
                )}
              </div>
              <div className={`text-sm font-semibold ${TXT} truncate`}>{t.subject}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[#8b949e] truncate">{t.user_email}</span>
                <span className="text-[10px] text-[#8b949e] ml-auto flex-shrink-0">{fmtAgo(t.updated_at || t.created_at)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 min-w-0 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#8b949e]">
            <MessageSquare className="w-14 h-14 opacity-20 mb-3" />
            <p className="text-sm">Select a ticket to reply</p>
          </div>
        ) : (
          <>
            <div className={`px-6 py-4 border-b ${BORD} flex items-start justify-between gap-4`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-[#8b949e]">{selected.id}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold text-white bg-green-600">{selected.status?.toUpperCase()}</span>
                  {selected.priority !== 'normal' && <span className="text-[10px] text-amber-400 font-semibold">● {selected.priority}</span>}
                </div>
                <h2 className={`text-base font-bold ${TXT}`}>{selected.subject}</h2>
                <div className="text-xs text-[#8b949e]">{selected.user_email} · {selected.category}</div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {selected.status !== 'closed' && (
                  <button onClick={() => setStatus(selected.id, 'closed')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs ${SUB} border ${BORD} hover:bg-white/5`}>
                    <Lock className="w-3 h-3" /> Close
                  </button>
                )}
                {selected.status === 'closed' && (
                  <button onClick={() => setStatus(selected.id, 'open')}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-black" style={{ background: Y }}>
                    Reopen
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[calc(100vh-320px)]">
              {(selected.messages || []).map(m => (
                <div key={m.id} className={`flex gap-3 ${m.from === 'admin' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold`}
                    style={m.from === 'admin' ? { background: Y, color: 'black' } : { background: '#2d333b', color: '#e6edf3' }}>
                    {m.from === 'admin' ? 'A' : 'U'}
                  </div>
                  <div className={`max-w-[76%] rounded-xl px-4 py-3 text-sm ${CARD} border ${m.is_internal ? 'border-amber-500/30' : BORD}`}>
                    {m.is_internal && <div className="text-[10px] text-amber-400 font-bold mb-1">🔒 INTERNAL NOTE</div>}
                    <p className={`${TXT} whitespace-pre-wrap`}>{m.message}</p>
                    <div className="text-[10px] text-[#8b949e] mt-1">{m.sender_email} · {fmtAgo(m.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={`px-6 py-4 border-t ${BORD}`}>
              <label className="flex items-center gap-2 text-xs text-[#8b949e] mb-2 cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                🔒 Internal note only
              </label>
              <div className="flex gap-2">
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3}
                  placeholder="Type your reply…"
                  className={`flex-1 rounded-xl ${BG} border ${BORD} px-4 py-3 text-sm ${TXT} placeholder-[#8b949e] focus:outline-none focus:border-[#f5c518] resize-none`} />
                <button onClick={sendReply} disabled={sending || !replyText.trim()}
                  className="px-4 rounded-xl text-sm font-bold text-black disabled:opacity-50 flex items-center gap-1"
                  style={{ background: Y }}>
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Reply className="w-4 h-4" /> Send</>}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── NUMBERS ─────────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'US', name: 'United States', dial: '+1',  price: 1.99, sms: true,  best: true  },
  { code: 'GB', name: 'United Kingdom', dial: '+44', price: 1.99, sms: true,  best: true  },
  { code: 'NL', name: 'Netherlands',   dial: '+31', price: 1.99, sms: true,  best: true  },
  { code: 'AU', name: 'Australia',     dial: '+61', price: 7.50, sms: true,  best: true  },
  { code: 'BE', name: 'Belgium',       dial: '+32', price: 3.99, sms: false, best: false },
  { code: 'LT', name: 'Lithuania',     dial: '+370',price: 3.99, sms: false, best: false },
  { code: 'SE', name: 'Sweden',        dial: '+46', price: 10.00,sms: false, best: false },
  { code: 'PL', name: 'Poland',        dial: '+48', price: 10.00,sms: false, best: false },
  { code: 'ZA', name: 'South Africa',  dial: '+27', price: 11.99,sms: false, best: false },
  { code: 'TH', name: 'Thailand',      dial: '+66', price: 17.00,sms: false, best: false },
];

const FLAGS = { US:'🇺🇸', GB:'🇬🇧', NL:'🇳🇱', AU:'🇦🇺', BE:'🇧🇪', LT:'🇱🇹', SE:'🇸🇪', PL:'🇵🇱', ZA:'🇿🇦', TH:'🇹🇭' };

function NumbersPanel() {
  const navigate = useNavigate();
  const [numbers, setNumbers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin/numbers?limit=200')
      .then(d => { setNumbers(d.numbers || []); setStats({ pool_available: d.pool_available, pool_total: d.pool_total, total: d.total }); })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const best = COUNTRIES.filter(c => c.best);
  const intl  = COUNTRIES.filter(c => !c.best);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className={`text-sm font-bold ${TXT} mb-1`}>Virtual Numbers</h2>
        <p className={`text-xs ${SUB}`}>Browse and buy numbers by country — click ＋ to view live inventory</p>
        {stats && (
          <div className="flex gap-4 mt-2">
            <span className="text-xs text-[#8b949e]">Total assigned: <span style={{ color: Y }} className="font-bold">{stats.total}</span></span>
            <span className="text-xs text-[#8b949e]">Pool available: <span style={{ color: Y }} className="font-bold">{stats.pool_available}</span></span>
          </div>
        )}
      </div>

      <div className={`${CARD} rounded-xl border ${BORD} overflow-hidden`}>
        <div className={`px-5 py-3 border-b ${BORD} text-[11px] uppercase tracking-wider text-[#8b949e] font-semibold`}>Best Sellers</div>
        {best.map((c, i) => (
          <div key={c.code} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? `border-t ${BORD}` : ''} hover:bg-white/[0.03] transition-colors`}>
            <span className="text-2xl">{FLAGS[c.code]}</span>
            <div className="flex-1">
              <div className={`text-sm font-semibold ${TXT}`}>{c.name} <span className="text-[#8b949e] font-normal">({c.dial})</span></div>
              <div className="text-xs text-[#8b949e]">SMS {c.sms ? '✅' : '—'} &nbsp;·&nbsp; <span style={{ color: Y }}>${c.price.toFixed(2)}/mo</span></div>
            </div>
            <button onClick={() => navigate(`/area-codes?country=${c.code}`)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold transition-all hover:opacity-80"
              style={{ background: Y }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className={`${CARD} rounded-xl border ${BORD} overflow-hidden`}>
        <div className={`px-5 py-3 border-b ${BORD} text-[11px] uppercase tracking-wider text-[#8b949e] font-semibold`}>International Numbers</div>
        {intl.map((c, i) => (
          <div key={c.code} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? `border-t ${BORD}` : ''} hover:bg-white/[0.03] transition-colors`}>
            <span className="text-2xl">{FLAGS[c.code]}</span>
            <div className="flex-1">
              <div className={`text-sm font-semibold ${TXT}`}>{c.name} <span className="text-[#8b949e] font-normal">({c.dial})</span></div>
              <div className="text-xs text-[#8b949e]">SMS {c.sms ? '✅' : '—'} &nbsp;·&nbsp; <span style={{ color: Y }}>${c.price.toFixed(2)}/mo</span></div>
            </div>
            <button onClick={() => navigate(`/area-codes?country=${c.code}`)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-black font-bold transition-all hover:opacity-80"
              style={{ background: Y }}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProxyPanel() {
  const [blob, setBlob] = useState('');
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    api('/api/proxy/admin').then(setCurrent).catch(() => setCurrent({ configured: false }));
  }, []);

  const save = async () => {
    if (!blob.trim()) { toast.error('Paste the SMSPVA API key'); return; }
    setSaving(true);
    try {
      const d = await api('/api/proxy/admin', {
        method: 'PUT',
        body: JSON.stringify({ apikey: blob.trim(), enabled: true }),
      });
      setCurrent(d);
      toast.success(d.supplier_ready ? 'SMSPVA linked — customers can buy' : (d.note || 'Saved'));
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const disable = async () => {
    setSaving(true);
    try {
      await api('/api/proxy/admin', { method: 'PUT', body: JSON.stringify({ enabled: false }) });
      setCurrent({ configured: false, supplier_ready: false });
      toast.success('Supplier unlinked');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-xl">
      <p className={`text-sm ${SUB} mb-4 leading-relaxed`}>
        Customers buy IPv4 Dedicated proxies on /proxy (wallet). Calliotel rents them from SMSPVA via API
        (<code>proxies_api.php</code>). Paste your SMSPVA <strong>API key</strong> from Profile & API key.
      </p>
      <div className={`mb-4 p-4 rounded-xl border ${BORD}`}>
        <p className={`text-sm ${TXT} font-bold`}>
          {current?.supplier_ready ? 'Supplier linked' : 'Supplier not linked — catalog still shows, buy is off'}
        </p>
        <p className={`text-xs ${SUB} mt-1`}>Sold: {current?.sold ?? 0}</p>
      </div>
      <textarea
        value={blob}
        onChange={(e) => setBlob(e.target.value)}
        placeholder="SMSPVA API key"
        className={`w-full h-24 mb-3 px-3 py-2 rounded-lg bg-black/40 border ${BORD} ${TXT} text-sm`}
      />
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={saving}
          className="px-4 py-2 rounded-lg text-black text-sm font-bold" style={{ background: Y }}>
          {saving ? 'Saving…' : 'Save API key'}
        </button>
        {current?.configured && (
          <button type="button" onClick={disable} disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm border ${BORD} ${SUB}`}>
            Unlink
          </button>
        )}
      </div>
    </div>
  );
}

// ─── TOPBAR ──────────────────────────────────────────────────────────────────
function TopBar({ section, onRefresh, refreshing }) {
  const labels = {
    overview: 'Overview', users: 'Users', purchases: 'Purchases',
    referrals: 'Referrals', notifications: 'Notifications',
    'email-blast': 'Email Blast', tickets: 'Support Tickets', numbers: 'Numbers', proxy: 'SMSPVA Proxy',
  };
  const subs = {
    overview: 'Real-time platform metrics',
    users: 'All user accounts — click any row to see full history',
    purchases: 'Pending crypto payments awaiting confirmation',
    referrals: 'Referral tracking and affiliate commissions',
    notifications: 'Send in-app notifications or push blasts to all users',
    'email-blast': 'Send emails to all registered users',
    tickets: 'Reply to customer support requests',
    numbers: 'Virtual number inventory by country',
    proxy: 'Link SMSPVA so /proxy can sell IPv4 Dedicated to customers.',
  };
  return (
    <div className={`flex items-center justify-between px-6 py-4 border-b ${BORD} sticky top-0 z-20`} style={{ background: '#0d1117' }}>
      <div>
        <h1 className={`text-base font-bold ${TXT}`}>{labels[section] || 'Dashboard'}</h1>
        <p className={`text-xs ${SUB}`}>{subs[section] || ''}</p>
      </div>
      <button onClick={onRefresh} disabled={refreshing}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs ${SUB} border ${BORD} hover:bg-white/5 disabled:opacity-50 transition-all`}>
        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
      </button>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function AdminDashboardV2() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [collapsed, setCollapsed] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [openTickets, setOpenTickets] = useState(0);

  const isAdmin = user && ADMIN_EMAILS.has((user.email || '').toLowerCase());

  const loadOverview = useCallback(async () => {
    setRefreshing(true);
    try {
      const [dash, crypto, traffic] = await Promise.all([
        api('/api/admin/dashboard').catch(() => null),
        api('/api/admin/crypto/pending?limit=1').catch(() => ({ total: 0 })),
        api('/api/admin/traffic').catch(() => null),
      ]);
      setDashboard({
        ...(dash || {}),
        pending_crypto: crypto?.total || 0,
        traffic_by_source: traffic?.by_source || [],
        traffic_by_country: traffic?.by_country || [],
      });
    } catch {}
    finally { setRefreshing(false); }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) { navigate('/dashboard'); return; }
    loadOverview();
  }, [user, isAdmin, loadOverview, navigate]);

  useEffect(() => {
    if (!isAdmin) return;
    api('/api/support/admin/tickets?status=open&limit=1')
      .then(d => setOpenTickets(d.open_count || 0))
      .catch(() => null);
  }, [isAdmin, section]);

  if (!user) return <div className={`min-h-screen flex items-center justify-center ${BG} ${TXT}`}>Loading…</div>;
  if (!isAdmin) return null;

  return (
    <div className={`min-h-screen flex ${BG} ${TXT}`}>
      <Sidebar
        section={section}
        onChange={(s) => setSection(s)}
        onLogout={() => { logout(); navigate('/'); }}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        openTickets={openTickets}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar section={section} onRefresh={loadOverview} refreshing={refreshing} />
        <div className="flex-1 overflow-y-auto">
          {section === 'overview'      && <Overview dash={dashboard} onGoTo={setSection} />}
          {section === 'users'         && <UsersPanel />}
          {section === 'purchases'     && <PurchasesPanel />}
          {section === 'referrals'     && <ReferralsPanel />}
          {section === 'notifications' && <NotificationsPanel />}
          {section === 'email-blast'   && <EmailBlastPanel />}
          {section === 'tickets'       && <TicketsPanel />}
          {section === 'numbers'       && <NumbersPanel />}
          {section === 'proxy'         && <ProxyPanel />}
        </div>
      </div>
    </div>
  );
}
