import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Phone, Bell, DollarSign, ShoppingBag,
  Settings, LogOut, Search, Ban, CheckCircle, Trash2, PlusCircle,
  MinusCircle, Shield, RefreshCw, Send, ChevronDown, ChevronRight,
  Eye, EyeOff, X, TrendingUp, Activity, Wifi, WifiOff, Menu,
  UserCheck, UserX, CreditCard, MessageSquare, AlertTriangle,
  BarChart3, Globe, Zap, Crown, ArrowUp, ArrowDown, Clock,
  Copy, ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;
const token = () => localStorage.getItem('token');
const authHeaders = () => ({ 'Authorization': `Bearer ${token()}`, 'Content-Type': 'application/json' });

const ADMIN_EMAILS = [
  'admin@calliotel.com', 'bigboss@calliotel.com',
  'alinmy77@gmail.com', 'worl212211@yahoo.com', 'astor539@gmail.com'
];

// ─── Stat Card ───────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = '#10b981', trend }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #111827, #1f2937)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 16, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 8
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{sub}</div>}
      {trend !== undefined && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: trend >= 0 ? '#10b981' : '#ef4444' }}>
          {trend >= 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(trend)} today
        </div>
      )}
    </div>
  );
}

// ─── Mini Bar Chart ──────────────────────────────────────────
function MiniBarChart({ data, valueKey, color = '#10b981', label }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d[valueKey]), 1);
  return (
    <div style={{ background: 'linear-gradient(135deg, #111827, #1f2937)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: '100%', height: `${Math.max((d[valueKey] / max) * 72, 4)}px`, background: `linear-gradient(to top, ${color}, ${color}88)`, borderRadius: 4, transition: 'height 0.3s ease' }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{d.date?.slice(-5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────
function Badge({ children, color = '#10b981' }) {
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 100, background: `${color}22`, color, fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  );
}

// ─── Modal ───────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460, boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', color: '#fff' }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Input ───────────────────────────────────────────────────
function AdminInput({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>}
      <input {...props} style={{
        width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none',
        boxSizing: 'border-box', ...props.style
      }} />
    </div>
  );
}

function AdminTextarea({ label, ...props }) {
  return (
    <div style={{ marginBottom: 16 }}>
      {label && <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>}
      <textarea {...props} style={{
        width: '100%', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none',
        boxSizing: 'border-box', resize: 'vertical', minHeight: 80, ...props.style
      }} />
    </div>
  );
}

function AdminBtn({ children, color = '#10b981', outline, small, ...props }) {
  return (
    <button {...props} style={{
      background: outline ? 'transparent' : color,
      border: outline ? `1px solid ${color}` : 'none',
      color: outline ? color : '#fff',
      borderRadius: 10, padding: small ? '6px 14px' : '10px 20px',
      fontSize: small ? 12 : 14, fontWeight: 700, cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', gap: 6,
      transition: 'opacity 0.15s', opacity: props.disabled ? 0.5 : 1,
      ...props.style
    }}>
      {children}
    </button>
  );
}

// ─── Sections ─────────────────────────────────────────────────

const NAV = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'users', icon: Users, label: 'Users' },
  { id: 'numbers', icon: Phone, label: 'Numbers' },
  { id: 'notifications', icon: Bell, label: 'Notifications' },
  { id: 'transactions', icon: DollarSign, label: 'Transactions' },
  { id: 'pricing', icon: TrendingUp, label: 'Pricing' },
];

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Auth guard ────────────────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    const email = user.email || user._id;
    if (!ADMIN_EMAILS.includes(email)) {
      toast.error('Admin access required');
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const SIDEBAR_W = sidebarOpen ? 240 : 72;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#060611', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Sidebar ────────────────────────────────────────── */}
      <aside style={{
        width: SIDEBAR_W, minHeight: '100vh', background: '#0a0a14',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
        transition: 'width 0.2s ease', overflow: 'hidden', flexShrink: 0
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Shield size={18} color="#fff" />
          </div>
          {sidebarOpen && <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Calliotel</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Admin Panel</div>
          </div>}
          <button onClick={() => setSidebarOpen(v => !v)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
            <Menu size={16} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {NAV.map(({ id, icon: Icon, label }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: active ? '#10b981' : 'rgba(255,255,255,0.5)',
                fontWeight: active ? 700 : 500, fontSize: 14,
                transition: 'all 0.15s', textAlign: 'left', width: '100%',
                borderLeft: active ? '2px solid #10b981' : '2px solid transparent'
              }}>
                <Icon size={18} style={{ flexShrink: 0 }} />
                {sidebarOpen && <span>{label}</span>}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {sidebarOpen && user && (
            <div style={{ padding: '8px 12px', marginBottom: 8, borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.full_name || 'Admin'}</div>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email || user._id}</div>
            </div>
          )}
          <button onClick={() => navigate('/dashboard')} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
            borderRadius: 12, border: 'none', cursor: 'pointer', background: 'transparent',
            color: 'rgba(255,255,255,0.4)', fontSize: 14, width: '100%'
          }}>
            <LogOut size={18} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span>Back to App</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
        <div style={{ padding: '28px 32px', maxWidth: 1400 }}>
          {section === 'overview' && <OverviewSection />}
          {section === 'users' && <UsersSection />}
          {section === 'numbers' && <NumbersSection />}
          {section === 'notifications' && <NotificationsSection />}
          {section === 'transactions' && <TransactionsSection />}
          {section === 'pricing' && <PricingSection />}
        </div>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// OVERVIEW
// ═══════════════════════════════════════════════════════════════
function OverviewSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/dashboard`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setData(d);
    } catch (e) { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Overview" sub="Platform health at a glance" onRefresh={load} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard icon={Users} label="Total Users" value={fmt(data?.users?.total)} sub={`${data?.users?.verified} verified`} trend={data?.users?.new_today} />
        <StatCard icon={Activity} label="Active (7d)" value={fmt(data?.users?.active_week)} sub={`${data?.users?.banned} banned`} color="#10b981" />
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${fmt(data?.revenue?.total)}`} sub={`$${fmt(data?.revenue?.monthly)} this month`} color="#8b5cf6" trend={data?.revenue?.today} />
        <StatCard icon={Phone} label="Numbers" value={fmt(data?.numbers?.active)} sub={`${data?.numbers?.pool_available} in pool`} color="#06b6d4" />
        <StatCard icon={Bell} label="Push Subscribers" value={fmt(data?.push?.subscribers)} sub="Active devices" color="#10b981" />
        <StatCard icon={CreditCard} label="Transactions" value={fmt(data?.transactions?.total)} sub={`${data?.transactions?.today} today`} color="#ec4899" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <MiniBarChart data={data?.charts?.signups} valueKey="count" color="#10b981" label="New Signups (7 days)" />
        <MiniBarChart data={data?.charts?.revenue} valueKey="amount" color="#8b5cf6" label="Revenue $ (7 days)" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════
function UsersSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState({});
  const [creditModal, setCreditModal] = useState(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('Admin adjustment');
  const [deleteModal, setDeleteModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = search
        ? `${API}/api/admin/users/search?q=${encodeURIComponent(search)}`
        : `${API}/api/admin/users/list?limit=200`;
      const r = await fetch(url, { headers: authHeaders() });
      const d = await r.json();
      setUsers(d.users || []);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  const act = async (userId, action) => {
    setActionLoading(p => ({ ...p, [userId + action]: true }));
    try {
      let r;
      if (action === 'ban') r = await fetch(`${API}/api/admin/users/${encodeURIComponent(userId)}/ban`, { method: 'POST', headers: authHeaders() });
      else if (action === 'unban') r = await fetch(`${API}/api/admin/users/${encodeURIComponent(userId)}/unban`, { method: 'POST', headers: authHeaders() });
      else if (action === 'verify') r = await fetch(`${API}/api/admin/users/${encodeURIComponent(userId)}/verify`, { method: 'PUT', headers: authHeaders() });
      const d = await r.json();
      if (d.success) { toast.success(d.message); load(); }
      else toast.error(d.detail || 'Action failed');
    } catch { toast.error('Network error'); }
    finally { setActionLoading(p => ({ ...p, [userId + action]: false })); }
  };

  const adjustCredits = async (force = false) => {
    const amt = parseFloat(creditAmount);
    if (isNaN(amt) || amt === 0) return toast.error('Enter a valid amount');
    try {
      const r = await fetch(`${API}/api/admin/users/${encodeURIComponent(creditModal.id || creditModal.email)}/credits`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ amount: amt, reason: creditReason, force })
      });
      const d = await r.json();
      if (r.status === 409) {
        const msg = typeof d.detail === 'string' ? d.detail : d.detail?.message;
        if (window.confirm(`${msg || 'This account already used a number.'}\n\nOverride and credit anyway?`)) {
          return adjustCredits(true);
        }
        return toast.error(msg || 'Refund blocked — number was used');
      }
      if (d.success) { toast.success(d.message); setCreditModal(null); setCreditAmount(''); load(); }
      else toast.error((typeof d.detail === 'string' ? d.detail : d.detail?.message) || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const deleteUser = async () => {
    const uid = deleteModal.id || deleteModal.email;
    try {
      const r = await fetch(`${API}/api/admin/users/${encodeURIComponent(uid)}`, { method: 'DELETE', headers: authHeaders() });
      const d = await r.json();
      if (d.success) { toast.success('User deleted'); setDeleteModal(null); load(); }
      else toast.error(d.detail || 'Failed');
    } catch { toast.error('Network error'); }
  };

  const filtered = users.filter(u => {
    if (filter === 'banned') return u.banned;
    if (filter === 'unverified') return !u.email_verified;
    if (filter === 'active') return !u.banned && u.email_verified;
    return true;
  });

  return (
    <div>
      <SectionHeader title="Users" sub={`${users.length} loaded`} onRefresh={load} />

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by email, name..."
            style={{ width: '100%', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px 10px 36px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        {['all', 'active', 'banned', 'unverified'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: filter === f ? '#10b981' : 'rgba(255,255,255,0.06)',
            color: filter === f ? '#fff' : 'rgba(255,255,255,0.5)'
          }}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      {loading ? <Spinner /> : (
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#0f172a' }}>
                {['User', 'Balance', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const uid = u.id || u.email || u._id;
                const email = u.email || u._id || '—';
                return (
                  <tr key={uid || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                          {(u.full_name || email)[0]?.toUpperCase()}
                        </div>
                        <div>
                          <div style={{ color: '#fff', fontWeight: 600 }}>{u.full_name || u.username || '—'}</div>
                          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#10b981', fontWeight: 700 }}>${(u.wallet_balance || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {u.banned ? <Badge color="#ef4444">Banned</Badge> : <Badge color="#10b981">Active</Badge>}
                        {u.email_verified ? <Badge color="#06b6d4">Verified</Badge> : <Badge color="#10b981">Unverified</Badge>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {u.banned
                          ? <AdminBtn small color="#10b981" onClick={() => act(uid, 'unban')} disabled={actionLoading[uid + 'unban']}><UserCheck size={12} />Unban</AdminBtn>
                          : <AdminBtn small color="#ef4444" outline onClick={() => act(uid, 'ban')} disabled={actionLoading[uid + 'ban']}><UserX size={12} />Ban</AdminBtn>
                        }
                        <AdminBtn small color="#8b5cf6" outline onClick={() => { setCreditModal(u); setCreditAmount(''); }}><CreditCard size={12} />Credits</AdminBtn>
                        {!u.email_verified && <AdminBtn small color="#06b6d4" outline onClick={() => act(uid, 'verify')} disabled={actionLoading[uid + 'verify']}><CheckCircle size={12} />Verify</AdminBtn>}
                        <AdminBtn small color="#ef4444" outline onClick={() => setDeleteModal(u)}><Trash2 size={12} /></AdminBtn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No users found</div>}
        </div>
      )}

      {/* Credits Modal */}
      <Modal open={!!creditModal} onClose={() => setCreditModal(null)} title="Adjust Credits">
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 16 }}>
          User: <strong style={{ color: '#fff' }}>{creditModal?.email || creditModal?._id}</strong><br />
          Current balance: <strong style={{ color: '#10b981' }}>${(creditModal?.wallet_balance || 0).toFixed(2)}</strong>
        </div>
        <AdminInput label="Amount (negative to deduct)" type="number" value={creditAmount} onChange={e => setCreditAmount(e.target.value)} placeholder="e.g. 10 or -5" />
        <AdminInput label="Reason" value={creditReason} onChange={e => setCreditReason(e.target.value)} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <AdminBtn outline color="#888" onClick={() => setCreditModal(null)}>Cancel</AdminBtn>
          <AdminBtn onClick={adjustCredits}><PlusCircle size={14} />Apply</AdminBtn>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Delete User">
        <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 20 }}>
          Are you sure you want to permanently delete <strong style={{ color: '#ef4444' }}>{deleteModal?.email || deleteModal?._id}</strong>? This cannot be undone.
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <AdminBtn outline color="#888" onClick={() => setDeleteModal(null)}>Cancel</AdminBtn>
          <AdminBtn color="#ef4444" onClick={deleteUser}><Trash2 size={14} />Delete</AdminBtn>
        </div>
      </Modal>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NUMBERS
// ═══════════════════════════════════════════════════════════════
function NumbersSection() {
  const [poolStats, setPoolStats] = useState(null);
  const [poolNumbers, setPoolNumbers] = useState([]);
  const [assignedNumbers, setAssignedNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [poolInput, setPoolInput] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // /api/admin/pool returns the active number-pool inventory.
      const poolRes = await fetch(`${API}/api/admin/pool?limit=200`, { headers: authHeaders() });
      const poolData = await poolRes.json();
      const numbers = poolData.numbers || [];
      const total = typeof poolData.total === 'number' ? poolData.total : numbers.length;
      const available = numbers.filter(n => n.status === 'available').length;
      const assigned = numbers.filter(n => n.status === 'assigned' || n.assigned_to_user);
      setPoolStats({ total, available });
      setPoolNumbers(numbers);
      setAssignedNumbers(assigned);
    } catch { toast.error('Failed to load numbers'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addNumbers = async () => {
    const lines = poolInput.trim().split('\n').filter(l => l.trim());
    if (!lines.length) return;
    setAdding(true);
    try {
      // /api/admin/pool/bulk-add expects List[PoolNumberCreate] directly.
      const COUNTRY_NAMES = { US: 'United States', CA: 'Canada', GB: 'United Kingdom', DE: 'Germany' };
      const numbers = lines.map(line => {
        const parts = line.trim().split(',');
        const phone = parts[0].trim();
        const country_code = (parts[1]?.trim() || 'US').toUpperCase();
        return {
          phone_number: phone,
          country_code,
          country_name: COUNTRY_NAMES[country_code] || country_code,
          city: parts[2]?.trim() || null,
        };
      });
      const r = await fetch(`${API}/api/admin/pool/bulk-add`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(numbers)
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`Added ${d.added}, skipped ${d.skipped}`);
        setPoolInput('');
        load();
      } else toast.error('Failed to add numbers');
    } catch { toast.error('Error'); }
    finally { setAdding(false); }
  };

  const removeNumber = async (num) => {
    try {
      const r = await fetch(`${API}/api/admin/pool/${encodeURIComponent(num)}`, { method: 'DELETE', headers: authHeaders() });
      const d = await r.json();
      if (d.success) { toast.success(`Removed ${num}`); load(); }
    } catch { toast.error('Failed'); }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <SectionHeader title="Virtual Numbers" sub="Manage number pool & assignments" onRefresh={load} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatCard icon={Phone} label="Pool Available" value={fmt(poolStats?.available || 0)} color="#10b981" />
        <StatCard icon={Phone} label="Pool Total" value={fmt(poolStats?.total || 0)} color="#06b6d4" />
        <StatCard icon={Users} label="Assigned" value={fmt(assignedNumbers.length)} color="#10b981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Add Numbers */}
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Add Numbers to Pool</h3>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 }}>One per line: +1XXXXXXXXXX, US, City, State</p>
          <AdminTextarea value={poolInput} onChange={e => setPoolInput(e.target.value)} placeholder={"+12125551234, US, New York, NY\n+12025551234, US, Washington, DC"} style={{ minHeight: 120 }} />
          <AdminBtn onClick={addNumbers} disabled={adding || !poolInput.trim()}>
            <PlusCircle size={14} />{adding ? 'Adding...' : 'Add to Pool'}
          </AdminBtn>
        </div>

        {/* Pool Numbers */}
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Pool Numbers ({poolNumbers.length})</h3>
          <div style={{ maxHeight: 240, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {poolNumbers.slice(0, 50).map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                <div>
                  <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{n.phone_number}</div>
                  <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{n.country_code || n.country} {n.city || ''}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {(n.status === 'assigned' || n.assigned_to_user) ? <Badge color="#ef4444">Taken</Badge> : <Badge color="#10b981">Free</Badge>}
                  <button onClick={() => removeNumber(n.phone_number)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 4, cursor: 'pointer', color: '#ef4444' }}><Trash2 size={12} /></button>
                </div>
              </div>
            ))}
            {poolNumbers.length === 0 && <div style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: 20 }}>No numbers in pool</div>}
          </div>
        </div>
      </div>

      {/* Assigned Numbers Table */}
      <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Assigned Numbers ({assignedNumbers.length})</h3>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Number', 'User', 'Service', 'Country', 'Status', 'Expires'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assignedNumbers.slice(0, 100).map((n, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 16px', color: '#06b6d4', fontWeight: 600, fontFamily: 'monospace' }}>{n.phone_number || n.number}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.7)' }}>{n.user_email || n.user_id || '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.7)' }}>{n.service_name || n.service || '—'}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)' }}>{n.country || '—'}</td>
                  <td style={{ padding: '10px 16px' }}><Badge color={n.status === 'active' ? '#10b981' : '#10b981'}>{n.status || 'active'}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{n.expires_at ? new Date(n.expires_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {assignedNumbers.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No assigned numbers</div>}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════
function NotificationsSection() {
  const [pushTitle, setPushTitle] = useState('');
  const [pushBody, setPushBody] = useState('');
  const [pushUrl, setPushUrl] = useState('/');
  const [sendingPush, setSendingPush] = useState(false);

  const [inAppTitle, setInAppTitle] = useState('');
  const [inAppMessage, setInAppMessage] = useState('');
  const [sendingInApp, setSendingInApp] = useState(false);

  const [pushStats, setPushStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const r = await fetch(`${API}/api/admin/push/stats`, { headers: authHeaders() });
      const d = await r.json();
      if (d.success) setPushStats(d);
    } catch { }
    finally { setLoadingStats(false); }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const sendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) return toast.error('Title and body required');
    setSendingPush(true);
    try {
      const r = await fetch(`${API}/api/admin/push/broadcast`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: pushTitle, body: pushBody, url: pushUrl || '/' })
      });
      const d = await r.json();
      if (d.success) {
        toast.success(`✅ Push sent to ${d.sent} device(s)${d.failed ? ` (${d.failed} failed)` : ''}`);
        setPushTitle(''); setPushBody(''); setPushUrl('/');
        loadStats();
      } else toast.error(d.detail || 'Failed to send');
    } catch { toast.error('Network error'); }
    finally { setSendingPush(false); }
  };

  const sendInApp = async () => {
    if (!inAppTitle.trim() || !inAppMessage.trim()) return toast.error('Title and message required');
    setSendingInApp(true);
    try {
      const r = await fetch(`${API}/api/admin/broadcast`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ title: inAppTitle, message: inAppMessage })
      });
      const d = await r.json();
      if (d.success) {
        toast.success(d.message);
        setInAppTitle(''); setInAppMessage('');
        loadStats();
      } else toast.error(d.detail || 'Failed');
    } catch { toast.error('Network error'); }
    finally { setSendingInApp(false); }
  };

  return (
    <div>
      <SectionHeader title="Notifications" sub="Push & in-app broadcasts" onRefresh={loadStats} />

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard icon={Wifi} label="Push Subscribers" value={fmt(pushStats?.active_subscribers)} sub="Active devices" color="#10b981" />
        <StatCard icon={Send} label="Broadcasts Sent" value={fmt(pushStats?.broadcasts_sent)} color="#8b5cf6" />
        <StatCard icon={Bell} label="Total Subscriptions" value={fmt(pushStats?.total_subscriptions)} color="#10b981" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>

        {/* Push Notification */}
        <div style={{ background: '#111827', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={18} color="#10b981" />
            </div>
            <div>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>Web Push Notification</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Sent to all subscribed browsers & devices</p>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
          <AdminInput label="Title" value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="e.g. New Feature Released!" maxLength={60} />
          <AdminTextarea label="Message" value={pushBody} onChange={e => setPushBody(e.target.value)} placeholder="Write your notification message..." maxLength={200} />
          <AdminInput label="URL (optional)" value={pushUrl} onChange={e => setPushUrl(e.target.value)} placeholder="/" />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>~{pushStats?.active_subscribers || 0} recipients</span>
            <AdminBtn onClick={sendPush} disabled={sendingPush || !pushTitle || !pushBody}>
              <Send size={14} />{sendingPush ? 'Sending...' : 'Send Push'}
            </AdminBtn>
          </div>
        </div>

        {/* In-App Broadcast */}
        <div style={{ background: '#111827', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 16, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color="#8b5cf6" />
            </div>
            <div>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>In-App Broadcast</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>Appears in notification center for all users</p>
            </div>
          </div>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />
          <AdminInput label="Title" value={inAppTitle} onChange={e => setInAppTitle(e.target.value)} placeholder="e.g. Scheduled Maintenance" maxLength={80} />
          <AdminTextarea label="Message" value={inAppMessage} onChange={e => setInAppMessage(e.target.value)} placeholder="Your broadcast message to all users..." maxLength={500} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <AdminBtn color="#8b5cf6" onClick={sendInApp} disabled={sendingInApp || !inAppTitle || !inAppMessage}>
              <MessageSquare size={14} />{sendingInApp ? 'Sending...' : 'Send to All Users'}
            </AdminBtn>
          </div>
        </div>
      </div>

      {/* Push History */}
      {pushStats?.recent_broadcasts?.length > 0 && (
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 style={{ color: '#fff', fontWeight: 700 }}>Push Broadcast History</h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Title', 'Message', 'Sent', 'Failed', 'Sent By', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pushStats.recent_broadcasts.map((b, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 600 }}>{b.title}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', maxWidth: 200 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.body}</div></td>
                  <td style={{ padding: '10px 16px' }}><Badge color="#10b981">{b.sent_count || 0}</Badge></td>
                  <td style={{ padding: '10px 16px' }}><Badge color="#ef4444">{b.failed_count || 0}</Badge></td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{b.sent_by}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{b.sent_at ? new Date(b.sent_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TRANSACTIONS
// ═══════════════════════════════════════════════════════════════
function TransactionsSection() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/admin/transactions?limit=200`, { headers: authHeaders() });
      const d = await r.json();
      setTransactions(d.transactions || []);
      setTotal(d.total || 0);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = transactions.filter(t =>
    !search || (t.user_id || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.type || '').toLowerCase().includes(search.toLowerCase()) ||
    (t.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalRevenue = filtered.filter(t => ['deposit', 'credit_purchase', 'number_purchase', 'admin_credit'].includes(t.type)).reduce((a, b) => a + (b.amount || 0), 0);

  const TX_COLORS = {
    deposit: '#10b981', credit_purchase: '#10b981', number_purchase: '#06b6d4',
    admin_credit: '#8b5cf6', admin_debit: '#ef4444', refund: '#10b981',
    purchase: '#10b981', withdrawal: '#ef4444'
  };

  return (
    <div>
      <SectionHeader title="Transactions" sub={`${total} total records`} onRefresh={load} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard icon={DollarSign} label="Total Revenue" value={`$${totalRevenue.toFixed(2)}`} color="#10b981" />
        <StatCard icon={Activity} label="Total Records" value={fmt(total)} color="#8b5cf6" />
        <StatCard icon={CreditCard} label="Shown" value={fmt(filtered.length)} color="#06b6d4" />
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user, type, description..."
          style={{ width: '100%', background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px 10px 36px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {loading ? <Spinner /> : (
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0f172a' }}>
                {['Type', 'User', 'Amount', 'Balance After', 'Description', 'Date'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <Badge color={TX_COLORS[t.type] || '#888'}>{t.type?.replace(/_/g, ' ') || '—'}</Badge>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{t.user_id || '—'}</td>
                  <td style={{ padding: '10px 16px', fontWeight: 700, color: ['admin_debit', 'refund', 'withdrawal'].includes(t.type) ? '#ef4444' : '#10b981' }}>
                    {['admin_debit', 'withdrawal'].includes(t.type) ? '-' : '+'}${(t.amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)' }}>${(t.balance_after || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.5)', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '—'}</div>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                    {t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No transactions found</div>}
        </div>
      )}
    </div>
  );
}

// ─── Pricing Section ─────────────────────────────────────────
const MARKUP = 2.0;
const MIN_PRICE = 1.99;
const userPrice = (cost) => Math.max(cost * MARKUP, MIN_PRICE).toFixed(2);
const profit = (cost) => (parseFloat(userPrice(cost)) - cost).toFixed(2);

const SAMPLE_COUNTRIES = [
  { flag: '🇺🇸', name: 'United States', iso: 'US', providerCost: 1.20 },
  { flag: '🇬🇧', name: 'United Kingdom', iso: 'GB', providerCost: 1.60 },
  { flag: '🇨🇦', name: 'Canada', iso: 'CA', providerCost: 1.20 },
  { flag: '🇦🇺', name: 'Australia', iso: 'AU', providerCost: 2.10 },
  { flag: '🇩🇪', name: 'Germany', iso: 'DE', providerCost: 1.90 },
  { flag: '🇫🇷', name: 'France', iso: 'FR', providerCost: 1.80 },
  { flag: '🇳🇱', name: 'Netherlands', iso: 'NL', providerCost: 1.75 },
  { flag: '🇿🇦', name: 'South Africa', iso: 'ZA', providerCost: 2.50 },
  { flag: '🇳🇬', name: 'Nigeria', iso: 'NG', providerCost: 3.00 },
  { flag: '🇮🇳', name: 'India', iso: 'IN', providerCost: 2.80 },
  { flag: '🇵🇭', name: 'Philippines', iso: 'PH', providerCost: 2.20 },
  { flag: '🇦🇪', name: 'UAE', iso: 'AE', providerCost: 3.50 },
  { flag: '🇸🇦', name: 'Saudi Arabia', iso: 'SA', providerCost: 3.80 },
  { flag: '🇧🇷', name: 'Brazil', iso: 'BR', providerCost: 2.40 },
  { flag: '🇲🇽', name: 'Mexico', iso: 'MX', providerCost: 2.10 },
  { flag: '🇰🇪', name: 'Kenya', iso: 'KE', providerCost: 2.80 },
  { flag: '🇸🇬', name: 'Singapore', iso: 'SG', providerCost: 1.50 },
  { flag: '🇯🇵', name: 'Japan', iso: 'JP', providerCost: 2.60 },
];

function PricingSection() {
  const [liveData, setLiveData] = useState(null);
  const [loadingLive, setLoadingLive] = useState(false);
  const [markupInput, setMarkupInput] = useState(String(MARKUP));
  const [minInput, setMinInput] = useState(String(MIN_PRICE));
  const [previewMarkup, setPreviewMarkup] = useState(MARKUP);
  const [previewMin, setPreviewMin] = useState(MIN_PRICE);

  const fetchLive = useCallback(async () => {
    setLoadingLive(true);
    try {
      const r = await fetch(`${API}/api/didww/admin/pricing`, { headers: authHeaders() });
      const d = await r.json();
      setLiveData(d);
    } catch { /* silently fail */ }
    finally { setLoadingLive(false); }
  }, []);

  useEffect(() => { fetchLive(); }, [fetchLive]);

  const calcPrice = (cost) => Math.max(cost * previewMarkup, previewMin).toFixed(2);
  const calcProfit = (cost) => (parseFloat(calcPrice(cost)) - cost).toFixed(2);
  const calcMargin = (cost) => {
    const p = parseFloat(calcPrice(cost));
    return p > 0 ? ((p - cost) / p * 100).toFixed(0) : '0';
  };

  const rows = liveData?.countries?.length > 0 ? liveData.countries : SAMPLE_COUNTRIES;

  const totalMonthlyRevenue = rows.reduce((s, r) => s + parseFloat(calcPrice(r.providerCost)), 0);
  const totalMonthlyProfit  = rows.reduce((s, r) => s + parseFloat(calcProfit(r.providerCost)), 0);
  const avgMargin = (totalMonthlyProfit / totalMonthlyRevenue * 100).toFixed(0);

  const card = { background: '#111827', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 };

  return (
    <div>
      <SectionHeader title="Pricing & Profit" sub="How we calculate prices from Telnyx wholesale cost" onRefresh={fetchLive} />

      {/* ── Formula explanation ────────────────────────────── */}
      <div style={{ ...card, padding: 24, marginBottom: 20 }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          Pricing Formula
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Provider Cost', desc: 'Wholesale price from Telnyx (varies by country)', color: '#6366f1' },
            { op: '×' },
            { label: `${MARKUP}× Markup`, desc: 'Our profit multiplier', color: '#10b981' },
            { op: '=' },
            { label: 'User Price', desc: `min $${MIN_PRICE} always enforced`, color: '#22c55e' },
          ].map((item, i) => item.op ? (
            <div key={i} style={{ fontSize: 24, fontWeight: 800, color: 'rgba(255,255,255,0.3)' }}>{item.op}</div>
          ) : (
            <div key={i} style={{ flex: 1, minWidth: 140, background: `${item.color}15`, border: `1px solid ${item.color}33`, borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ fontWeight: 800, fontSize: 16, color: item.color }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(16,185,129,0.08)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
          <span style={{ color: '#10b981', fontFamily: 'monospace', fontSize: 14 }}>
            User Price = max(provider_cost × {MARKUP}, ${MIN_PRICE}) &nbsp;·&nbsp; Profit = User Price − provider_cost
          </span>
        </div>
      </div>

      {/* ── Live preview calculator ────────────────────────── */}
      <div style={{ ...card, padding: 24, marginBottom: 20 }}>
        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 }}>
          Preview Calculator  <span style={{ color: '#10b981', fontWeight: 500 }}>(read-only — contact dev to change)</span>
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display:'block', marginBottom:4 }}>Markup Multiplier</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" step="0.1" min="1" value={markupInput}
                onChange={e => { setMarkupInput(e.target.value); setPreviewMarkup(parseFloat(e.target.value) || MARKUP); }}
                style={{ width: 90, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#1f2937', color: '#fff', fontSize: 14, outline: 'none' }}
              />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>× cost</span>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display:'block', marginBottom:4 }}>Minimum Price ($)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="number" step="0.01" min="0" value={minInput}
                onChange={e => { setMinInput(e.target.value); setPreviewMin(parseFloat(e.target.value) || MIN_PRICE); }}
                style={{ width: 90, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: '#1f2937', color: '#fff', fontSize: 14, outline: 'none' }}
              />
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>/mo</span>
            </div>
          </div>
        </div>

        {/* Summary stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: 12 }}>
          {[
            { label: 'Avg Margin', value: `${avgMargin}%`, color: '#22c55e' },
            { label: 'Est. Revenue (18 countries)', value: `$${totalMonthlyRevenue.toFixed(2)}/mo`, color: '#6366f1' },
            { label: 'Est. Profit (18 countries)', value: `$${totalMonthlyProfit.toFixed(2)}/mo`, color: '#10b981' },
          ].map((s, i) => (
            <div key={i} style={{ background: '#1f2937', borderRadius: 10, padding: '12px 16px', border: `1px solid ${s.color}22` }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-country table ──────────────────────────────── */}
      <div style={{ ...card, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
            Per-Country Pricing Breakdown
          </span>
          {loadingLive && <span style={{ fontSize: 12, color: '#10b981' }}>Loading live data…</span>}
          {!loadingLive && liveData?.source === 'live' && <span style={{ fontSize: 12, color: '#22c55e' }}>● Live from Telnyx</span>}
          {!loadingLive && liveData?.source !== 'live' && <span style={{ fontSize: 12, color: '#10b981' }}>● Estimated (sample data)</span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Country', 'Provider Cost (wholesale)', 'Our Price (user pays)', 'Profit per Number', 'Margin %'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: 'rgba(255,255,255,0.4)', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const cost = row.providerCost;
                const price = calcPrice(cost);
                const pf = calcProfit(cost);
                const mg = calcMargin(cost);
                const isMin = parseFloat(price) === previewMin;
                return (
                  <tr key={row.iso || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ padding: '10px 16px', color: '#fff', fontWeight: 600 }}>
                      {row.flag} {row.name}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#6366f1', fontFamily: 'monospace' }}>${cost.toFixed(2)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ color: '#fff', fontFamily: 'monospace', fontWeight: 700 }}>${price}</span>
                      {isMin && <span style={{ marginLeft: 6, fontSize: 10, color: '#10b981', background: 'rgba(245,158,11,0.1)', padding: '1px 6px', borderRadius: 4 }}>min floor</span>}
                    </td>
                    <td style={{ padding: '10px 16px', color: '#22c55e', fontFamily: 'monospace', fontWeight: 700 }}>+${pf}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700,
                        background: parseInt(mg) >= 50 ? 'rgba(34,197,94,0.12)' : 'rgba(16,185,129,0.12)',
                        color: parseInt(mg) >= 50 ? '#22c55e' : '#10b981',
                      }}>{mg}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          * Prices shown are for preview. Actual Telnyx wholesale costs vary by area code and number type within a country.
          To change markup multiplier or minimum price, edit <code style={{ color: '#10b981' }}>MARKUP_MULTIPLIER</code> and <code style={{ color: '#10b981' }}>MIN_PRICE</code> in <code style={{ color: '#10b981' }}>backend/routes/telnyx_routes.py</code>.
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function SectionHeader({ title, sub, onRefresh }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
      <div>
        <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>{title}</h1>
        {sub && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '4px 0 0' }}>{sub}</p>}
      </div>
      {onRefresh && (
        <button onClick={onRefresh} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <RefreshCw size={14} />Refresh
        </button>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, border: '3px solid rgba(16,185,129,0.2)', borderTop: '3px solid #10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function EmptyState({ icon: Icon = Activity, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>
      <Icon size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
      <div style={{ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>{title}</div>
      {sub && <div style={{ fontSize: 14 }}>{sub}</div>}
    </div>
  );
}

function fmt(n) {
  if (n === undefined || n === null) return '—';
  return Number(n).toLocaleString();
}
