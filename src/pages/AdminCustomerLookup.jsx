import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Search, ArrowLeft, User, Wallet, Phone, FileText, Plus, Minus, Loader, AlertCircle, CheckCircle, RefreshCw, Ban, Unlock } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';

const API = process.env.REACT_APP_BACKEND_URL || '';

export default function AdminCustomerLookup() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [error, setError] = useState(null);
  const [creditAmt, setCreditAmt] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [creditBusy, setCreditBusy] = useState(false);
  const [tab, setTab] = useState('orders');

  const headers = () => ({ Authorization: `Bearer ${safeLocalStorage.getItem('token')}` });

  useEffect(() => { if (q.trim()) doSearch(); /* eslint-disable-next-line */ }, []);

  const doSearch = async () => {
    if (!q.trim()) return;
    setSearching(true); setError(null); setResults([]); setProfile(null);
    try {
      const res = await axios.get(`${API}/api/admin/users/search`, { params: { q: q.trim(), limit: 25 }, headers: headers() });
      setResults(res.data.users || []);
      if ((res.data.users || []).length === 1) {
        loadProfile(res.data.users[0]);
      } else if ((res.data.users || []).length === 0) {
        setError('No customer found. Try email, name, or username.');
      }
    } catch (e) {
      setError(e?.response?.data?.detail || 'Search failed');
    }
    setSearching(false);
  };

  const loadProfile = async (u) => {
    setLoadingProfile(true); setError(null); setProfile(null);
    const uid = u.id || u._id || u.user_id || u.email;
    try {
      const res = await axios.get(`${API}/api/admin/user/${encodeURIComponent(uid)}/profile`, { headers: headers() });
      setProfile(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || 'Profile load failed');
    }
    setLoadingProfile(false);
  };

    const adjustCredits = async (sign, force = false) => {
    if (!profile) return;
    const amt = parseFloat(creditAmt);
    if (!amt || amt <= 0) { setError('Enter positive amount'); return; }
    if (!creditReason.trim()) { setError('Reason required'); return; }
    setCreditBusy(true); setError(null);
    const uid = profile.user.id || profile.user.user_id || profile.user.email;
    try {
      const res = await axios.post(`${API}/api/admin/users/${encodeURIComponent(uid)}/credits`,
        { amount: sign * amt, reason: creditReason.trim(), force },
        { headers: headers() }
      );
      setCreditAmt(''); setCreditReason('');
      loadProfile(profile.user);
      alert(`✅ ${res.data.message}`);
    } catch (e) {
      const d = e?.response?.data?.detail;
      const msg = typeof d === 'string' ? d : d?.message;
      if (e?.response?.status === 409 && sign > 0 && !force) {
        const ok = window.confirm(
          `${msg || 'This account already used a number.'}\n\nOverride and credit anyway?`
        );
        if (ok) {
          setCreditBusy(false);
          return adjustCredits(sign, true);
        }
      }
      setError(msg || 'Credit adjust failed');
    }
    setCreditBusy(false);
  };

  const banToggle = async () => {
    if (!profile) return;
    const uid = profile.user.id || profile.user.user_id || profile.user.email;
    const action = profile.user.banned ? 'unban' : 'ban';
    if (!window.confirm(`${action.toUpperCase()} ${profile.user.email}?`)) return;
    try {
      await axios.post(`${API}/api/admin/users/${encodeURIComponent(uid)}/${action}`, {}, { headers: headers() });
      loadProfile(profile.user);
    } catch (e) {
      setError(e?.response?.data?.detail || `${action} failed`);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Admin
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Search className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Customer Lookup</h1>
            <p className="text-sm text-gray-400">Search by email, name, username · view wallet + orders · refund or ban</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex gap-2 mb-4">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="email  ·  phone bought (+13606125992)  ·  order ID  ·  name"
            autoFocus
            className="flex-1 bg-olive border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500"
          />
          <button onClick={doSearch} disabled={searching}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-bold flex items-center gap-2">
            {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500/40 rounded-lg flex items-start gap-2 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Multi-result list */}
        {results.length > 1 && !profile && (
          <div className="bg-olive border border-white/10 rounded-xl divide-y divide-white/5 mb-4">
            <div className="px-4 py-2 text-xs text-gray-400 uppercase">{results.length} matches — click one</div>
            {results.map(u => (
              <button key={u.id || u.email} onClick={() => loadProfile(u)}
                className="w-full text-left px-4 py-3 hover:bg-white/5 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{u.email}</div>
                  <div className="text-xs text-gray-400">{u.full_name || u.username || '—'} · joined {(u.created_at || '').slice(0, 10)}</div>
                </div>
                <div className="text-sm text-gray-300">
                  ${(u.wallet_balance || 0).toFixed(2)}
                  {u.banned && <span className="ml-2 px-2 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">BANNED</span>}
                </div>
              </button>
            ))}
          </div>
        )}

        {loadingProfile && <div className="text-center py-8"><Loader className="w-6 h-6 animate-spin mx-auto" /></div>}

        {profile && (
          <>
            {/* Header card */}
            <div className="bg-olive border border-white/10 rounded-xl p-5 mb-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">
                    {(profile.user.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xl font-bold">{profile.user.email}</div>
                    <div className="text-sm text-gray-400">{profile.user.full_name || profile.user.username || '—'}</div>
                    <div className="text-xs text-gray-500 font-mono mt-1">{profile.user.id}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Joined {(profile.user.created_at || '').slice(0, 10)} · last login {(profile.user.last_login || '—').slice(0, 10)}
                      {profile.user.email_verified && <span className="ml-2 text-green-400">✓ verified</span>}
                      {profile.user.banned && <span className="ml-2 px-2 py-0.5 bg-red-900/50 text-red-400 text-xs rounded">BANNED</span>}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => loadProfile(profile.user)} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-sm flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" /> Refresh
                  </button>
                  <button onClick={banToggle} className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-500/40 text-red-400 rounded text-sm flex items-center gap-1">
                    {profile.user.banned ? <><Unlock className="w-3.5 h-3.5" /> Unban</> : <><Ban className="w-3.5 h-3.5" /> Ban</>}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-4">
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet</div>
                  <div className="text-2xl font-bold text-green-400">${(profile.wallet?.balance || 0).toFixed(2)}</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase mb-1">Lifetime Spend</div>
                  <div className="text-2xl font-bold text-white">${(profile.lifetime_spend || 0).toFixed(2)}</div>
                  <div className="text-xs text-gray-500">{profile.purchase_count || 0} purchases</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3">
                  <div className="text-xs text-gray-400 uppercase mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Numbers</div>
                  <div className="text-2xl font-bold text-white">{profile.number_count || 0}</div>
                </div>
              </div>
            </div>

            {/* Quick refund / credit */}
            <div className="bg-olive border border-yellow-500/30 rounded-xl p-4 mb-4">
              <div className="text-sm font-bold text-yellow-400 mb-2">⚡ Quick Wallet Adjust (refund / credit / debit)</div>
              <div className="grid sm:grid-cols-3 gap-2">
                <input type="number" step="0.01" value={creditAmt} onChange={e => setCreditAmt(e.target.value)}
                  placeholder="Amount $"
                  className="bg-black/30 border border-white/10 rounded px-3 py-2" />
                <input value={creditReason} onChange={e => setCreditReason(e.target.value)}
                  placeholder="Reason (e.g. PayPal OTP refund - never received)"
                  className="bg-black/30 border border-white/10 rounded px-3 py-2 sm:col-span-2" />
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => adjustCredits(1)} disabled={creditBusy || !creditAmt}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded font-bold flex items-center justify-center gap-1">
                  {creditBusy ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  REFUND / CREDIT
                </button>
                <button onClick={() => adjustCredits(-1)} disabled={creditBusy || !creditAmt}
                  className="flex-1 py-2 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 rounded font-bold flex items-center justify-center gap-1">
                  <Minus className="w-4 h-4" /> DEBIT
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-3 border-b border-white/10">
              <button onClick={() => setTab('orders')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === 'orders' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}>
                <Phone className="w-4 h-4 inline mr-1" /> Numbers / Orders ({profile.numbers?.length || 0})
              </button>
              <button onClick={() => setTab('tx')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 ${tab === 'tx' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400'}`}>
                <FileText className="w-4 h-4 inline mr-1" /> Wallet Activity ({profile.transactions?.length || 0})
              </button>
            </div>

            {tab === 'orders' && (
              <div className="bg-olive border border-white/10 rounded-xl overflow-hidden">
                {(profile.numbers || []).length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm">No numbers / orders yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-400 uppercase bg-black/30">
                        <tr>
                          <th className="text-left px-3 py-2">When</th>
                          <th className="text-left px-3 py-2">Number</th>
                          <th className="text-left px-3 py-2">Service / Country</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-left px-3 py-2">Price</th>
                          <th className="text-left px-3 py-2">Order ID</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.numbers.map((n, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-3 py-2 text-xs text-gray-400">{(n.created_at || '').slice(0, 19).replace('T', ' ')}</td>
                            <td className="px-3 py-2 font-mono">{n.phone_number || n.number || '—'}</td>
                            <td className="px-3 py-2">{n.service || '—'} / {n.country || '—'}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                n.status === 'completed' || n.sms_code ? 'bg-green-900/50 text-green-400' :
                                n.status === 'cancelled' || n.status === 'refunded' ? 'bg-gray-700/50 text-gray-400' :
                                n.status === 'expired' ? 'bg-red-900/50 text-red-400' :
                                'bg-yellow-900/50 text-yellow-400'
                              }`}>
                                {(n.status || 'unknown').toUpperCase()}
                              </span>
                              {n.sms_code && <span className="ml-2 text-xs text-green-400 font-mono">{n.sms_code}</span>}
                            </td>
                            <td className="px-3 py-2">${(n.price || n.cost || 0).toFixed(2)}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-400">{n.order_id || n.order_code || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'tx' && (
              <div className="bg-olive border border-white/10 rounded-xl overflow-hidden">
                {(profile.transactions || []).length === 0 ? (
                  <div className="text-center text-gray-400 py-8 text-sm">No wallet activity.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-gray-400 uppercase bg-black/30">
                        <tr>
                          <th className="text-left px-3 py-2">When</th>
                          <th className="text-left px-3 py-2">Type</th>
                          <th className="text-left px-3 py-2">Amount</th>
                          <th className="text-left px-3 py-2">Balance After</th>
                          <th className="text-left px-3 py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profile.transactions.map((t, i) => {
                          const isCredit = (t.type || '').includes('credit') || (t.type || '').includes('deposit') || (t.type || '').includes('refund');
                          return (
                            <tr key={i} className="border-t border-white/5">
                              <td className="px-3 py-2 text-xs text-gray-400">{((t.created_at || t.timestamp) || '').slice(0, 19).replace('T', ' ')}</td>
                              <td className="px-3 py-2 text-xs">{t.type}</td>
                              <td className={`px-3 py-2 font-bold ${isCredit ? 'text-green-400' : 'text-red-400'}`}>
                                {isCredit ? '+' : '−'}${Math.abs(t.amount || 0).toFixed(2)}
                              </td>
                              <td className="px-3 py-2">${(t.balance_after || 0).toFixed(2)}</td>
                              <td className="px-3 py-2 text-xs text-gray-300">{t.description || t.category || '—'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
