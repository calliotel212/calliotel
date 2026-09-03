import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, Phone, MessageSquare, DollarSign, Activity,
  Download, ArrowLeft, RefreshCw, Loader, Globe, Hash
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';
import { useNavigate } from 'react-router-dom';
import useGoBack from '../hooks/useGoBack';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const COLORS = ['#10b981', '#fbbf24', '#4ade80', '#F5A623', '#a78bfa', '#f472b6'];

const EnhancedAnalyticsPage = () => {
  const [numbers, setNumbers] = useState([]);
  const [smsMessages, setSmsMessages] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState(30);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const goBack = useGoBack('/dashboard');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const h = { Authorization: `Bearer ${token}` };
      const [numRes, smsRes, txRes, balRes] = await Promise.all([
        axios.get(`${API}/numbers/my-numbers`, { headers: h }).catch(() => ({ data: { numbers: [] } })),
        axios.get(`${API}/sms/inbox`, { headers: h }).catch(() => ({ data: { messages: [] } })),
        axios.get(`${API}/wallet/transactions?limit=200`, { headers: h }).catch(() => ({ data: { transactions: [] } })),
        axios.get(`${API}/wallet/balance`, { headers: h }).catch(() => ({ data: { balance: 0 } })),
      ]);
      setNumbers(numRes.data.numbers || numRes.data || []);
      setSmsMessages(smsRes.data.messages || []);
      setTransactions(txRes.data.transactions || []);
      setBalance(balRes.data.balance ?? 0);
    } catch {
      toast({ title: 'Error', description: 'Could not load analytics', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const now = new Date();
  const cutoff = new Date(now.getTime() - period * 86400000);
  const recentSMS = smsMessages.filter(m => new Date(m.created_at) >= cutoff);
  const recentTx = transactions.filter(t => new Date(t.created_at) >= cutoff);

  const totalNumbers = numbers.length;
  const smsSent = recentSMS.filter(m => m.direction === 'outbound').length;
  const smsReceived = recentSMS.filter(m => m.direction === 'inbound').length;
  const totalSpent = recentTx.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalAdded = recentTx.filter(t => t.type === 'credit').reduce((s, t) => s + Math.abs(t.amount), 0);

  const countryMap = {};
  numbers.forEach(n => {
    const c = n.country || 'Unknown';
    countryMap[c] = (countryMap[c] || 0) + 1;
  });
  const countryData = Object.entries(countryMap).map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const dailySMS = (() => {
    const days = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { weekday: 'short' });
      days[key] = { name: key, sent: 0, received: 0 };
    }
    recentSMS.forEach(m => {
      const d = new Date(m.created_at);
      const key = d.toLocaleDateString('en-US', { weekday: 'short' });
      if (days[key]) {
        if (m.direction === 'outbound') days[key].sent++;
        else days[key].received++;
      }
    });
    return Object.values(days);
  })();

  const spendingByType = (() => {
    const map = { 'Numbers': 0, 'SMS': 0, 'Other': 0 };
    recentTx.filter(t => t.type === 'debit').forEach(t => {
      const d = (t.description || '').toLowerCase();
      if (d.includes('number') || d.includes('virtual') || d.includes('renewal')) map['Numbers'] += t.amount;
      else if (d.includes('sms') || d.includes('message')) map['SMS'] += t.amount;
      else map['Other'] += t.amount;
    });
    return Object.entries(map).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));
  })();

  const handleExport = () => {
    const data = {
      exported_at: new Date().toISOString(),
      period_days: period,
      summary: { totalNumbers, smsSent, smsReceived, totalSpent, totalAdded, balance },
      numbers: numbers.map(n => ({ phone: n.phone_number, country: n.country, status: n.status })),
      sms_count: { sent: smsSent, received: smsReceived },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `calliotel-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    toast({ title: 'Exported', description: 'Analytics data downloaded' });
  };

  return (
    <div className="min-h-screen text-white pb-20" style={{ background: '#060610' }}>
      <header style={{ background: 'rgba(6,6,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => goBack()} style={{ padding: 8, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800 }}>Analytics</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Your telecom usage & stats</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={() => fetchAll(true)} style={{ padding: 8, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex' }}>
              <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer' }}>
              <Download className="w-4 h-4" /> Export
            </button>
          </div>
        </div>
      </header>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 120 }}>
          <Loader className="w-10 h-10 animate-spin" style={{ color: '#10b981' }} />
        </div>
      ) : (
        <div className="max-w-5xl mx-auto px-4 py-6" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setPeriod(d)} style={{
                padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                background: period === d ? '#10b981' : 'rgba(255,255,255,0.05)',
                color: period === d ? '#fff' : 'rgba(255,255,255,0.5)',
                border: period === d ? 'none' : '1px solid rgba(255,255,255,0.08)',
              }}>{d} Days</button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: Phone, label: 'Active Numbers', value: totalNumbers, color: '#F5A623', bg: 'rgba(96,165,250,0.1)', border: 'rgba(96,165,250,0.2)' },
              { icon: MessageSquare, label: 'SMS Sent', value: smsSent, color: '#10b981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
              { icon: MessageSquare, label: 'SMS Received', value: smsReceived, color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.2)' },
              { icon: DollarSign, label: 'Total Spent', value: `$${totalSpent.toFixed(2)}`, color: '#fbbf24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.2)' },
            ].map((s, i) => (
              <div key={i} style={{ borderRadius: 16, padding: '18px 16px', background: s.bg, border: `1px solid ${s.border}`, textAlign: 'center' }}>
                <s.icon className="w-5 h-5 mx-auto mb-2" style={{ color: s.color }} />
                <p style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div style={{ borderRadius: 18, padding: '20px 22px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingUp className="w-4 h-4" style={{ color: '#10b981' }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>SMS Activity (Last 7 Days)</span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailySMS}>
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                <Bar dataKey="sent" fill="#10b981" radius={[4, 4, 0, 0]} name="Sent" />
                <Bar dataKey="received" fill="#4ade80" radius={[4, 4, 0, 0]} name="Received" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {countryData.length > 0 && (
              <div style={{ borderRadius: 18, padding: '20px 22px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Globe className="w-4 h-4" style={{ color: '#F5A623' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Numbers by Country</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={countryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} (${value})`}>
                      {countryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {spendingByType.length > 0 && (
              <div style={{ borderRadius: 18, padding: '20px 22px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <DollarSign className="w-4 h-4" style={{ color: '#fbbf24' }} />
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Spending Breakdown</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={spendingByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name} $${value}`}>
                      {spendingByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div style={{ borderRadius: 18, padding: '20px 22px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Hash className="w-4 h-4" style={{ color: '#a78bfa' }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Quick Summary</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Balance', value: `$${balance.toFixed(2)}`, color: '#4ade80' },
                { label: 'Total Added', value: `$${totalAdded.toFixed(2)}`, color: '#F5A623' },
                { label: 'Total Messages', value: smsSent + smsReceived, color: '#10b981' },
                { label: 'Countries', value: countryData.length, color: '#a78bfa' },
              ].map((s, i) => (
                <div key={i} style={{ padding: '14px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                  <p style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default EnhancedAnalyticsPage;
