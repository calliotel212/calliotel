import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Crown, Plus, Loader, AlertCircle, ArrowLeft, RefreshCw, Users, DollarSign, TrendingUp, Wine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';

const API = process.env.REACT_APP_BACKEND_URL || '';

const POPULAR_SERVICES = ['WhatsApp', 'Telegram', 'PayPal', 'Stripe', 'Cash App', 'Venmo', 'Coinbase', 'Binance', 'Wise', 'Revolut', 'Google', 'Facebook', 'Instagram', 'TikTok', 'Twitter/X', 'Custom'];
const POPULAR_COUNTRIES = ['US', 'CA', 'UK', 'PR', 'DO', 'JM', 'MX', 'BR', 'ID', 'PH', 'IN', 'NG', 'GH', 'KE', 'ZA', 'PK', 'BD'];
const PAY_METHODS = ['usdt', 'cash', 'wallet', 'btc', 'bank', 'other'];

export default function AdminVIPConcierge() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [members, setMembers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    member_handle: '',
    service: 'WhatsApp',
    country: 'US',
    amount_charged: 4,
    wholesale_cost: 0.30,
    payment_method: 'usdt',
    delivered: 'number+otp',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const headers = () => ({ Authorization: `Bearer ${safeLocalStorage.getItem('token')}` });

  useEffect(() => { refresh(); }, []);

  const refresh = async () => {
    setLoading(true); setError(null);
    try {
      const [s, m, o] = await Promise.all([
        axios.get(`${API}/api/vip/stats`, { headers: headers() }),
        axios.get(`${API}/api/vip/members`, { headers: headers() }),
        axios.get(`${API}/api/vip/orders?days=30`, { headers: headers() }),
      ]);
      setStats(s.data); setMembers(m.data.members || []); setOrders(o.data.orders || []);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Load failed');
    }
    setLoading(false);
  };

  const submit = async () => {
    if (!form.member_handle.trim()) { setError('Member handle required'); return; }
    setSubmitting(true); setError(null); setSuccess(null);
    try {
      const res = await axios.post(`${API}/api/vip/orders`, form, { headers: headers() });
      setSuccess(`✅ Recorded — profit $${res.data.profit.toFixed(2)} 🥂`);
      setForm({ ...form, member_handle: '', notes: '' });
      refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Save failed');
    }
    setSubmitting(false);
  };

  const refundOrder = async (id) => {
    if (!window.confirm('Mark this order as refunded?')) return;
    try {
      await axios.post(`${API}/api/vip/orders/${id}/refund`, {}, { headers: headers() });
      refresh();
    } catch (e) {
      setError(e?.response?.data?.detail || 'Refund failed');
    }
  };

  const profit = (form.amount_charged || 0) - (form.wholesale_cost || 0);

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>

        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-500/30 to-emerald-500/20 flex items-center justify-center">
              <Crown className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">VIP Concierge <Wine className="w-6 h-6 text-yellow-400" /></h1>
              <p className="text-sm text-gray-400">Manual high-margin sales · Telegram/WhatsApp community · $4 flat 🥂</p>
            </div>
          </div>
          <button onClick={refresh} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm">
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'TODAY', data: stats?.today, icon: <DollarSign className="w-4 h-4" />, accent: 'text-green-400' },
            { label: 'WEEK', data: stats?.week, icon: <TrendingUp className="w-4 h-4" />, accent: 'text-blue-400' },
            { label: 'MONTH', data: stats?.month, icon: <TrendingUp className="w-4 h-4" />, accent: 'text-purple-400' },
            { label: 'MEMBERS', data: { revenue: stats?.member_count || 0, count: members.length, profit: 0 }, icon: <Users className="w-4 h-4" />, accent: 'text-yellow-400', isMember: true },
          ].map((c, i) => (
            <div key={i} className="bg-olive border border-white/10 rounded-xl p-4">
              <div className={`text-xs ${c.accent} flex items-center gap-1 mb-1`}>{c.icon} {c.label}</div>
              {c.isMember ? (
                <div className="text-2xl font-bold">{c.data?.revenue || 0}</div>
              ) : (
                <>
                  <div className="text-2xl font-bold text-white">${(c.data?.revenue || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-400">profit <span className="text-green-400 font-bold">${(c.data?.profit || 0).toFixed(2)}</span> · {c.data?.count || 0} sales</div>
                </>
              )}
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Quick Sale form */}
          <div className="bg-olive border border-yellow-500/30 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-5 h-5 text-yellow-400" />
              <h2 className="text-lg font-bold">Record Manual Sale 🥂</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Member (Telegram @ or WhatsApp +)</label>
                <input value={form.member_handle} onChange={e => setForm({ ...form, member_handle: e.target.value })}
                  list="vip-members" autoFocus
                  placeholder="@user123  or  +234813696..."
                  className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white" />
                <datalist id="vip-members">
                  {members.map(m => <option key={m.id} value={m.handle}>{m.display_name || ''} · ${m.total_spent?.toFixed(2)} spent</option>)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Service</label>
                  <select value={form.service} onChange={e => setForm({ ...form, service: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                    {POPULAR_SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Country</label>
                  <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                    {POPULAR_COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Charged $</label>
                  <input type="number" step="0.50" value={form.amount_charged}
                    onChange={e => setForm({ ...form, amount_charged: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-green-400 font-bold text-lg" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Our cost $</label>
                  <input type="number" step="0.05" value={form.wholesale_cost}
                    onChange={e => setForm({ ...form, wholesale_cost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-red-300" />
                </div>
              </div>

              <div className={`p-3 rounded-lg text-center text-sm ${profit > 0 ? 'bg-green-900/30 text-green-400' : 'bg-gray-800/50 text-gray-400'}`}>
                Profit: <b className="text-xl">${profit.toFixed(2)}</b>
                {form.amount_charged > 0 && form.wholesale_cost > 0 && (
                  <span className="text-xs ml-2 opacity-70">({((profit / form.amount_charged) * 100).toFixed(0)}% margin)</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Paid via</label>
                  <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 uppercase">
                    {PAY_METHODS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Delivered</label>
                  <select value={form.delivered} onChange={e => setForm({ ...form, delivered: e.target.value })}
                    className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2">
                    <option value="number+otp">Number + OTP</option>
                    <option value="number_only">Number only</option>
                    <option value="account">Full account</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes (optional)"
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-white text-sm" />

              {error && <div className="p-2 bg-red-900/30 border border-red-500/40 rounded text-sm text-red-300 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>}
              {success && <div className="p-2 bg-green-900/30 border border-green-500/40 rounded text-sm text-green-300">{success}</div>}

              <button onClick={submit} disabled={submitting || !form.member_handle.trim()}
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-emerald-500 hover:from-yellow-400 hover:to-emerald-400 disabled:opacity-40 rounded-lg font-bold text-lg flex items-center justify-center gap-2 text-black">
                {submitting ? <Loader className="w-5 h-5 animate-spin" /> : <>🥂 RECORD ${form.amount_charged.toFixed(2)} SALE</>}
              </button>
            </div>
          </div>

          {/* Recent orders */}
          <div className="bg-olive border border-white/10 rounded-xl p-5">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              Recent Concierge Sales
              <span className="text-xs text-gray-400 font-normal">last 30 days · {orders.length}</span>
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {orders.length === 0 ? (
                <div className="text-center text-gray-500 py-8 text-sm">No sales yet — record your first 🥂</div>
              ) : orders.map(o => (
                <div key={o.id} className={`p-3 rounded-lg border ${o.status === 'refunded' ? 'bg-gray-900/30 border-gray-700 opacity-60' : 'bg-black/30 border-white/5'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-yellow-400">{o.member_handle}</div>
                      <div className="text-xs text-gray-300">
                        {o.service}{o.country && ` · ${o.country}`} · {o.delivered}
                      </div>
                      {o.notes && <div className="text-xs text-gray-500 italic mt-0.5 truncate">{o.notes}</div>}
                      <div className="text-[10px] text-gray-500 mt-1">{(o.created_at || '').slice(0, 19).replace('T', ' ')} · {(o.payment_method || '').toUpperCase()}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-green-400 font-bold">${o.amount_charged?.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">profit ${o.profit?.toFixed(2)}</div>
                      {o.status !== 'refunded' && (
                        <button onClick={() => refundOrder(o.id)} className="text-[10px] text-red-400 hover:underline mt-1">refund</button>
                      )}
                      {o.status === 'refunded' && <div className="text-[10px] text-red-400">REFUNDED</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top members */}
        {members.length > 0 && (
          <div className="bg-olive border border-white/10 rounded-xl p-5 mt-6">
            <h2 className="text-lg font-bold mb-3">VIP Members ({members.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-400 uppercase border-b border-white/10">
                  <tr>
                    <th className="text-left py-2">Handle</th>
                    <th className="text-left py-2">Display Name</th>
                    <th className="text-left py-2">Platform</th>
                    <th className="text-right py-2">Orders</th>
                    <th className="text-right py-2">Total Spent</th>
                    <th className="text-left py-2 pl-4">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {[...members].sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0)).map(m => (
                    <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="py-2 font-mono text-yellow-400">{m.handle}</td>
                      <td className="py-2">{m.display_name || '—'}</td>
                      <td className="py-2 text-xs text-gray-400">{m.platform}</td>
                      <td className="py-2 text-right">{m.total_orders || 0}</td>
                      <td className="py-2 text-right text-green-400 font-bold">${(m.total_spent || 0).toFixed(2)}</td>
                      <td className="py-2 pl-4 text-xs text-gray-500">{(m.last_active_at || '').slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
