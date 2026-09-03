import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft, Check, X, Loader2, ShieldCheck, DollarSign,
  Users, Wallet, RefreshCw, AlertTriangle,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const ADMIN_EMAILS = new Set([
  'admin@calliotel.com', 'bigboss@calliotel.com',
  'alinmy77@gmail.com', 'worl212211@yahoo.com', 'astor539@gmail.com',
]);

const fmtMoney = (n) => `$${Number(n || 0).toFixed(2)}`;
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
};

export default function AdminApprovalsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  // Users awaiting approval
  const [users, setUsers] = useState([]);
  const [usersGate, setUsersGate] = useState({ enabled: true, minTopup: 1.0, total: 0 });

  // Affiliate commissions awaiting approval
  const [comms, setComms] = useState([]);
  const [commsTotals, setCommsTotals] = useState({ amount: 0, count: 0, autoApprove: false });

  const headers = useCallback(() => ({
    Authorization: `Bearer ${safeLocalStorage.getItem('token')}`,
  }), []);

  const isAdmin = user && (
    ADMIN_EMAILS.has((user.email || '').toLowerCase()) ||
    ADMIN_EMAILS.has((user.id || '').toLowerCase())
  );

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        axios.get(`${API}/referrals/admin/users/pending`, { headers: headers() }),
        axios.get(`${API}/referrals/admin/affiliate/pending`, { headers: headers() }),
      ]);
      setUsers(u.data.items || []);
      setUsersGate({
        enabled: !!u.data.gate_enabled,
        minTopup: Number(u.data.auto_approve_min_topup || 1),
        total: Number(u.data.total_pending_count || 0),
      });
      setComms(c.data.items || []);
      setCommsTotals({
        amount: Number(c.data.total_pending_amount || 0),
        count: Number(c.data.total_pending_count || 0),
        autoApprove: !!c.data.auto_approve_enabled,
      });
    } catch (e) {
      toast({
        title: 'Failed to load',
        description: e?.response?.data?.detail || 'Are you logged in as admin?',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [headers, toast]);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, loadAll]);

  // ── User actions ──
  const approveUser = async (uid, email) => {
    setBusy(`u:${uid}`);
    try {
      await axios.post(`${API}/referrals/admin/users/approve/${encodeURIComponent(uid)}`,
        {}, { headers: headers() });
      toast({ title: '✅ User unlocked', description: email || uid });
      setUsers(prev => prev.filter(x => x.id !== uid));
      setUsersGate(g => ({ ...g, total: Math.max(0, g.total - 1) }));
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const rejectUser = async (uid, email) => {
    const reason = window.prompt(`Reject ${email || uid}? Optional reason:`, '');
    if (reason === null) return;
    setBusy(`u:${uid}`);
    try {
      await axios.post(`${API}/referrals/admin/users/reject/${encodeURIComponent(uid)}`,
        { reason }, { headers: headers() });
      toast({ title: '🚫 User rejected', description: email || uid });
      setUsers(prev => prev.filter(x => x.id !== uid));
      setUsersGate(g => ({ ...g, total: Math.max(0, g.total - 1) }));
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  // ── Commission actions ──
  const approveCommission = async (cid, amount) => {
    setBusy(`c:${cid}`);
    try {
      const r = await axios.post(`${API}/referrals/admin/affiliate/approve/${encodeURIComponent(cid)}`,
        {}, { headers: headers() });
      toast({
        title: '✅ Paid out',
        description: `${fmtMoney(r.data.amount || amount)} → referrer wallet`,
      });
      setComms(prev => prev.filter(x => x.id !== cid));
      setCommsTotals(t => ({
        ...t,
        amount: Math.max(0, t.amount - Number(amount || 0)),
        count: Math.max(0, t.count - 1),
      }));
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const rejectCommission = async (cid) => {
    const reason = window.prompt('Reject this commission? Optional reason:', '');
    if (reason === null) return;
    setBusy(`c:${cid}`);
    try {
      await axios.post(`${API}/referrals/admin/affiliate/reject/${encodeURIComponent(cid)}`,
        { reason }, { headers: headers() });
      toast({ title: '🚫 Commission rejected' });
      setComms(prev => prev.filter(x => x.id !== cid));
      setCommsTotals(t => ({ ...t, count: Math.max(0, t.count - 1) }));
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const approveAllCommissions = async () => {
    if (!window.confirm(`Approve ALL ${commsTotals.count} pending commissions (${fmtMoney(commsTotals.amount)})?`)) return;
    setBusy('all');
    try {
      const r = await axios.post(`${API}/referrals/admin/affiliate/approve-all`,
        {}, { headers: headers() });
      toast({
        title: '✅ Bulk approved',
        description: `${r.data.approved} paid · ${fmtMoney(r.data.total_paid)} total · ${r.data.failed} failed`,
      });
      await loadAll();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  // ── Render guards ──
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Checking session…</p>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <Card className="bg-slate-900 border-slate-700 max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-amber-400" />
            <p className="font-bold text-lg mb-2">Admin only</p>
            <p className="text-sm text-slate-400 mb-4">
              You need to be logged in with an admin email.
            </p>
            <Button onClick={() => navigate('/')}>Back to home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-white">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/admin')}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Admin
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              Approvals
            </h1>
          </div>
          <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 border-b border-slate-800">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === 'users'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="inline h-4 w-4 mr-1" />
            Users <Badge className="ml-1 bg-emerald-600">{usersGate.total}</Badge>
          </button>
          <button
            onClick={() => setTab('commissions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              tab === 'commissions'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="inline h-4 w-4 mr-1" />
            Commissions <Badge className="ml-1 bg-amber-600">{commsTotals.count}</Badge>
          </button>
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            Loading…
          </div>
        )}

        {!loading && tab === 'users' && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <Users className="h-5 w-5" /> Users awaiting approval
                </span>
                <span className="text-xs font-normal text-slate-400">
                  Auto-unlock on top-up ≥ {fmtMoney(usersGate.minTopup)} ·
                  Gate {usersGate.enabled ? <span className="text-emerald-400">ON</span> : <span className="text-red-400">OFF</span>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  ✅ No users pending. Everyone's been triaged.
                </p>
              ) : (
                <div className="space-y-2">
                  {users.map(u => (
                    <div key={u.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{u.email || u.id}</div>
                        <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span><Wallet className="inline h-3 w-3 mr-1" />{fmtMoney(u.wallet_balance)}</span>
                          <span>Joined: {fmtDate(u.created_at)}</span>
                          <span>By: {u.referred_by_email || '—'}</span>
                          {u.utm_source && <span>via {u.utm_source}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => approveUser(u.id, u.email)}
                          disabled={busy === `u:${u.id}`}
                        >
                          {busy === `u:${u.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Approve</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejectUser(u.id, u.email)}
                          disabled={busy === `u:${u.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!loading && tab === 'commissions' && (
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" /> Affiliate commissions awaiting payout
                </span>
                <span className="text-xs font-normal text-slate-400">
                  Pending: <span className="text-amber-300 font-bold">{fmtMoney(commsTotals.amount)}</span>
                  {commsTotals.autoApprove && <span className="ml-2 text-amber-400">(auto-approve ON)</span>}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comms.length === 0 ? (
                <p className="text-slate-400 text-center py-8">
                  ✅ No commissions pending.
                </p>
              ) : (
                <>
                  <div className="mb-3 flex justify-end">
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700"
                      onClick={approveAllCommissions}
                      disabled={busy === 'all'}
                    >
                      {busy === 'all' ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                      Approve all ({commsTotals.count})
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {comms.map(c => (
                      <div key={c.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium">
                            <span className="text-amber-300">{fmtMoney(c.amount)}</span>
                            <span className="text-slate-500 mx-2">·</span>
                            <span className="text-sm text-slate-300">
                              {Math.round((c.commission_pct || 0) * 100)}% of {fmtMoney(c.gross_amount)}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span>To: {c.referrer_email}</span>
                            <span>From: {c.buyer_email}</span>
                            <span>Order: {c.order_code || '—'}</span>
                            <span>{fmtDate(c.created_at)}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => approveCommission(c.id, c.amount)}
                            disabled={busy === `c:${c.id}`}
                          >
                            {busy === `c:${c.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Check className="h-4 w-4 mr-1" />Pay</>}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rejectCommission(c.id)}
                            disabled={busy === `c:${c.id}`}
                          >
                            <X className="h-4 w-4 mr-1" />Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
