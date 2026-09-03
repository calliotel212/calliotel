import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import { useAuth } from '../context/AuthContext';
import {
  ChevronLeft, Check, X, Loader2, ShieldCheck, Mail, Calendar, DollarSign, Settings,
} from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const ADMIN_EMAILS = new Set([
  'admin@calliotel.com', 'bigboss@calliotel.com',
  'alinmy77@gmail.com', 'worl212211@yahoo.com', 'astor539@gmail.com',
]);

export default function AdminResellersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState([]);
  const [busy, setBusy] = useState(null);
  const [showCaps, setShowCaps] = useState(null);
  const [capCustomers, setCapCustomers] = useState('');
  const [capDaily, setCapDaily] = useState('');

  const headers = () => ({
    Authorization: `Bearer ${safeLocalStorage.getItem('token')}`,
  });

  const isAdmin = user && (
    ADMIN_EMAILS.has((user.email || '').toLowerCase()) ||
    ADMIN_EMAILS.has((user.id || '').toLowerCase())
  );

  const load = async () => {
    try {
      const r = await axios.get(`${API}/reseller/admin/applications`, { headers: headers() });
      setApps(r.data.applications || []);
    } catch (e) {
      toast({
        title: 'Failed to load',
        description: e?.response?.data?.detail || 'Are you logged in as admin?',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const approve = async (uid) => {
    setBusy(uid);
    try {
      await axios.post(`${API}/reseller/admin/applications/${encodeURIComponent(uid)}/approve`,
        {}, { headers: headers() });
      toast({ title: '✅ Approved', description: `${uid} is now a verified reseller.` });
      await load();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const reject = async (uid) => {
    if (!window.confirm(`Reject reseller application from ${uid}?`)) return;
    setBusy(uid);
    try {
      await axios.post(`${API}/reseller/admin/applications/${encodeURIComponent(uid)}/reject`,
        {}, { headers: headers() });
      toast({ title: '❌ Rejected', description: uid });
      await load();
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  const updateCaps = async (uid) => {
    setBusy(uid);
    try {
      const params = {};
      if (capCustomers !== '') params.customer_cap = parseInt(capCustomers, 10);
      if (capDaily !== '')     params.daily_fund_cap_usd = parseFloat(capDaily);
      await axios.put(`${API}/reseller/admin/users/${encodeURIComponent(uid)}/caps`,
        null, { headers: headers(), params });
      toast({ title: '⚙️ Caps updated', description: uid });
      setShowCaps(null);
      setCapCustomers('');
      setCapDaily('');
    } catch (e) {
      toast({ title: 'Failed', description: e?.response?.data?.detail || 'Try again', variant: 'destructive' });
    } finally { setBusy(null); }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 p-8 text-white">
        <Card className="max-w-md mx-auto bg-slate-900 border-red-500/40">
          <CardHeader><CardTitle>Admin Only</CardTitle></CardHeader>
          <CardContent>
            <p className="text-slate-300">You're not authorized to view this page.</p>
            <Button onClick={() => navigate('/dashboard')} className="mt-4">Back to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/20 p-4 md:p-8 text-white">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" onClick={() => navigate('/admin')} className="text-white mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Back to Admin
        </Button>

        <Card className="bg-slate-900/80 border-emerald-500/30 mb-6">
          <CardHeader>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-emerald-400" />
              <div>
                <CardTitle className="text-2xl">Reseller Applications</CardTitle>
                <p className="text-sm text-slate-400 mt-1">
                  Review pending applicants and approve them to unlock SMS sending for their sub-accounts.
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        {loading ? (
          <div className="text-center text-slate-400 py-12">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Loading applications...
          </div>
        ) : apps.length === 0 ? (
          <Card className="bg-slate-900/60 border-slate-700">
            <CardContent className="text-center py-12 text-slate-400">
              No pending reseller applications. 🎉
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {apps.map(a => (
              <Card key={a.user_id} className="bg-slate-900/80 border-slate-700">
                <CardContent className="p-5">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-bold text-white">{a.display_name || '(no brand name)'}</h3>
                        <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40">Pending</Badge>
                      </div>
                      <div className="text-sm text-slate-400 space-y-1">
                        <div className="flex items-center gap-2"><Mail className="h-4 w-4" /> {a.email}</div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Lifetime deposit: <b className="text-green-400">${a.lifetime_deposit_usd.toFixed(2)}</b>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Applied: {a.applied_at ? new Date(a.applied_at).toLocaleString() : '—'}
                        </div>
                        {a.account_created_at && (
                          <div className="text-xs text-slate-500">
                            Account age: {Math.round((Date.now() - new Date(a.account_created_at).getTime()) / 86400000)} days
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => approve(a.user_id)}
                        disabled={busy === a.user_id}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {busy === a.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                        Approve
                      </Button>
                      <Button
                        onClick={() => reject(a.user_id)}
                        disabled={busy === a.user_id}
                        variant="destructive"
                      >
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                      <Button
                        onClick={() => setShowCaps(showCaps === a.user_id ? null : a.user_id)}
                        variant="outline"
                        className="border-slate-600 text-slate-200"
                      >
                        <Settings className="h-4 w-4 mr-1" /> Caps
                      </Button>
                    </div>
                  </div>

                  {showCaps === a.user_id && (
                    <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-xs text-slate-400">Customer cap</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="10"
                          value={capCustomers}
                          onChange={e => setCapCustomers(e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-400">Daily fund cap (USD)</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="200"
                          value={capDaily}
                          onChange={e => setCapDaily(e.target.value)}
                          className="bg-slate-800 border-slate-700 text-white"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          onClick={() => updateCaps(a.user_id)}
                          disabled={busy === a.user_id || (capCustomers === '' && capDaily === '')}
                          className="w-full bg-emerald-500 hover:bg-emerald-600"
                        >
                          Save Caps
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
