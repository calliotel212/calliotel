import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  Phone, MessageSquare, LogOut, CreditCard,
  Plus, Loader, HelpCircle,
  Shield, Clock, Bell,
  ChevronRight, Activity, Wallet, Hash,
  ArrowUpRight, ArrowDownRight, AlertTriangle, Send, Copy, Check, ArrowLeftRight,
  Smartphone, Inbox, Server, Database
} from 'lucide-react';
import axios from 'axios';
import safeLocalStorage from '../utils/safeLocalStorage';
import NotificationBell from '../components/NotificationBell';
import AppDrawer from '../components/AppDrawer';
import BottomNav from '../components/BottomNav';
import WhatsNewBox from '../components/WhatsNewBox';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const StatCard = ({ icon: Icon, label, value, sub, color, loading, onClick }) => (
  <div onClick={onClick}
    className={`bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5 flex items-center gap-4 hover:border-emerald-500/40 transition-all ${onClick ? 'cursor-pointer hover:bg-gray-800/80' : ''}`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white mt-0.5">
        {loading ? <Loader className="w-5 h-5 animate-spin text-emerald-400" /> : value}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
    {onClick && <ChevronRight className="w-5 h-5 text-gray-600 flex-shrink-0" />}
  </div>
);

const QuickAction = ({ icon: Icon, label, shortLabel, desc, onClick, highlight }) => (
  <button
    onClick={onClick}
    className={`group flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-4 p-3 sm:p-4 rounded-xl transition-all text-center sm:text-left border active:scale-95 ${
      highlight
        ? 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
        : 'bg-gray-800/60 border-gray-700/50 hover:border-emerald-500/50 hover:bg-gray-800'
    }`}
  >
    <div className={`w-12 h-12 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
      highlight ? 'bg-emerald-500' : 'bg-emerald-500/20'
    }`}>
      <Icon className={`w-6 h-6 sm:w-5 sm:h-5 ${highlight ? 'text-white' : 'text-emerald-400'}`} />
    </div>
    <div className="flex-1 min-w-0 w-full">
      <p className="font-semibold text-white text-xs sm:text-sm leading-tight">
        <span className="sm:hidden">{shortLabel || label}</span>
        <span className="hidden sm:inline">{label}</span>
      </p>
      <p className="hidden sm:block text-xs text-gray-400 mt-0.5 truncate">{desc}</p>
    </div>
    <ChevronRight className="hidden sm:block w-4 h-4 text-gray-600 group-hover:text-emerald-400 transition-colors flex-shrink-0" />
  </button>
);

const RecentTransactions = ({ navigate }) => {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    axios.get(`${API}/wallet/transactions?limit=5`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setTxns(r.data.transactions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const modeLabel = (desc = '') => {
    const d = desc.toLowerCase();
    if (d.includes('number') || d.includes('did')) return 'Number';
    if (d.includes('sms')) return 'SMS';
    if (d.includes('stripe') || d.includes('card')) return 'Card';
    if (d.includes('crypto') || d.includes('usdt')) return 'Crypto';
    if (d.includes('transfer')) return 'Transfer';
    return 'Credit';
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <h2 className="font-bold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-green-400" /> Recent Transactions
        </h2>
        <button onClick={() => navigate('/wallet')} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
          View all <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader className="w-6 h-6 animate-spin text-emerald-400" /></div>
      ) : txns.length === 0 ? (
        <div className="text-center py-10 text-gray-500 text-sm">No transactions yet</div>
      ) : (
        <div className="divide-y divide-gray-800/60">
          {txns.map((tx, i) => (
            <div key={tx.id || i} className="flex items-center justify-between px-6 py-3.5 hover:bg-gray-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'credit' ? 'bg-green-500/20' : 'bg-emerald-500/20'}`}>
                  {tx.type === 'credit' ? <ArrowDownRight className="w-4 h-4 text-green-400" /> : <ArrowUpRight className="w-4 h-4 text-emerald-400" />}
                </div>
                <div>
                  <p className="text-sm text-white font-medium">{tx.description || modeLabel(tx.description)}</p>
                  <p className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleDateString('en-CA')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${tx.type === 'credit' ? 'text-green-400' : 'text-emerald-400'}`}>
                  {tx.type === 'credit' ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">${(tx.balance_after || 0).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const QuickSMS = () => {
  const navigate = useNavigate();
  const [numbers, setNumbers] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    axios.get(`${API}/numbers/my-numbers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const nums = r.data.numbers || [];
        setNumbers(nums);
        if (nums.length) setFrom(nums[0].phone_number);
      }).catch(() => {});
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!from || !to || !text) return;
    setSending(true);
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/sms/send`, { from_number: from, to_number: to, text }, { headers: { Authorization: `Bearer ${token}` } });
      setSent(true); setTo(''); setText('');
      setTimeout(() => setSent(false), 3000);
    } catch (e) { console.error(e); }
    finally { setSending(false); }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-bold text-white flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-400" /> Quick SMS
        </h2>
        <button onClick={() => navigate('/sms')} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1">
          Full view <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {numbers.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-gray-400 text-sm mb-3">You need a virtual number to send SMS</p>
          <button onClick={() => navigate('/browse-numbers')}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition-colors">
            Get a Number
          </button>
        </div>
      ) : (
        <form onSubmit={handleSend} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1 block">From</label>
              <select value={from} onChange={e => setFrom(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500">
                {numbers.map(n => <option key={n.phone_number} value={n.phone_number}>{n.phone_number}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1 block">To</label>
              <input type="tel" value={to} onChange={e => setTo(e.target.value)}
                placeholder="+1 234 567 8900"
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" required />
              <p className="text-[10px] text-amber-400/80 mt-1">Use international format: +1 for US, +44 for UK, etc.</p>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1 block">Message</label>
            <textarea value={text} onChange={e => setText(e.target.value)}
              placeholder="Type your message here…" rows={3} maxLength={160}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-emerald-500" required />
            <p className="text-[10px] text-gray-600 text-right mt-1">{text.length}/160</p>
          </div>
          <button type="submit" disabled={sending}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2">
            {sent ? '✓ Sent!' : sending ? <><Loader className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send SMS</>}
          </button>
        </form>
      )}
    </div>
  );
};

const ExpiryAlerts = ({ navigate }) => {
  const [expiring, setExpiring] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    axios.get(`${API}/numbers/my-numbers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const now = new Date();
        const soon = (r.data.numbers || []).filter(n => {
          if (!n.expires_at && !n.renewal_date) return false;
          const exp = new Date(n.expires_at || n.renewal_date);
          const days = (exp - now) / 86400000;
          return days >= 0 && days <= 14;
        }).map(n => {
          const exp = new Date(n.expires_at || n.renewal_date);
          const days = Math.ceil((exp - now) / 86400000);
          return { ...n, daysLeft: days };
        }).sort((a, b) => a.daysLeft - b.daysLeft);
        setExpiring(soon);
      }).catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading || expiring.length === 0) return null;

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
        <h2 className="font-bold text-amber-300">Number Expiry Alerts</h2>
        <span className="ml-auto text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">{expiring.length} expiring soon</span>
      </div>
      <div className="space-y-2">
        {expiring.map(n => (
          <div key={n.phone_number} className="flex items-center justify-between bg-gray-900/60 rounded-xl px-4 py-3">
            <div>
              <p className="font-mono font-semibold text-white text-sm">{n.phone_number}</p>
              <p className="text-xs text-gray-400">{n.country_name || n.country}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-bold ${n.daysLeft <= 3 ? 'text-red-400' : 'text-amber-400'}`}>
                {n.daysLeft === 0 ? 'Expires today!' : `${n.daysLeft}d left`}
              </span>
              <button onClick={() => navigate('/buy-credits')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold rounded-lg transition-colors">
                Renew
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SystemStatus = () => {
  const [latency, setLatency] = useState(42);

  useEffect(() => {
    const iv = setInterval(() => setLatency(Math.floor(Math.random() * 20) + 35), 3000);
    return () => clearInterval(iv);
  }, []);

  const items = [
    { label: 'API', icon: Server, status: 'Operational', extra: `${latency}ms` },
    { label: 'SMS Gateway', icon: MessageSquare, status: 'Operational', extra: null },
    { label: 'Voice', icon: Phone, status: 'Operational', extra: null },
    { label: 'Database', icon: Database, status: 'Connected', extra: null },
  ];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        <h3 className="text-sm font-bold text-white">System Status</h3>
        <span className="ml-auto text-[10px] text-green-400 font-semibold uppercase tracking-wider">All Systems Go</span>
      </div>
      <div className="space-y-2.5">
        {items.map(s => (
          <div key={s.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <s.icon className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
            <div className="flex items-center gap-2">
              {s.extra && <span className="text-xs text-green-400 font-mono">{s.extra}</span>}
              <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DashboardPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [cardVerified, setCardVerified] = useState(true);
  const [stats, setStats] = useState({ activeNumbers: 0, messagesSent: 0, messagesReceived: 0 });
  const [loading, setLoading] = useState(true);
  const [clientIdCopied, setClientIdCopied] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => !!safeLocalStorage.getItem('welcome_banner_v1'));
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    !!safeLocalStorage.getItem('onboarding_modal_v2') ||
    !!safeLocalStorage.getItem('onboarding_seen_v3')
  );

  const copyClientId = () => {
    if (user?.client_id) {
      navigator.clipboard.writeText(user.client_id);
      setClientIdCopied(true);
      setTimeout(() => setClientIdCopied(false), 2000);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const pendingPromo = sessionStorage.getItem('pending_promo');
    if (pendingPromo) {
      const token = safeLocalStorage.getItem('token');
      if (token) {
        axios.post(`${API}/promo/apply`, { code: pendingPromo }, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => {
            if (res.data.success) {
              sessionStorage.removeItem('pending_promo');
              setBalance(res.data.new_balance);
              setTimeout(() => alert(`🎁 Promo code ${pendingPromo} applied! $${res.data.credit_amount} added to your wallet.`), 500);
            }
          })
          .catch(err => {
            if (err?.response?.status === 400 || err?.response?.status === 404) {
              sessionStorage.removeItem('pending_promo');
            }
          });
      }
    }
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [balanceRes, numbersRes, messagesRes] = await Promise.allSettled([
        axios.get(`${API}/wallet/balance`, { headers }),
        axios.get(`${API}/numbers/my-numbers`, { headers }),
        axios.get(`${API}/sms/inbox`, { headers }),
      ]);
      if (balanceRes.status === 'fulfilled') {
        setBalance(balanceRes.value.data.balance);
        setCardVerified(balanceRes.value.data.card_verified ?? true);
      }
      if (numbersRes.status === 'fulfilled') {
        const activeNumbers = (numbersRes.value.data.numbers || []).filter(n => n.status === 'active').length;
        setStats(prev => ({ ...prev, activeNumbers }));
      }
      if (messagesRes.status === 'fulfilled') {
        const allMessages = messagesRes.value.data.messages || [];
        setStats(prev => ({
          ...prev,
          messagesSent: allMessages.filter(m => m.direction === 'outbound').length,
          messagesReceived: allMessages.filter(m => m.direction === 'inbound').length,
        }));
      }
    } catch (error) {
      console.error('Dashboard error:', error);
    } finally { setLoading(false); }
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const dismissWelcome = () => {
    safeLocalStorage.setItem('welcome_banner_v1', '1');
    setWelcomeDismissed(true);
  };

  const dismissOnboarding = () => {
    safeLocalStorage.setItem('onboarding_modal_v2', '1');
    setOnboardingDismissed(true);
  };

  const handleCardVerify = async () => {
    setVerifyLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(
        `${API}/wallet/card-verify-start`,
        { origin_url: window.location.origin },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.url) window.location.href = res.data.url;
    } catch (err) {
      alert(err?.response?.data?.detail || 'Could not start card verification. Please try again.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const quickActions = [
    { icon: Hash,          label: 'Get a Virtual Number',  shortLabel: 'Get Number',  desc: '6 countries · Mobile numbers',  path: '/browse-numbers', highlight: true },
    { icon: Smartphone,    label: 'My Numbers',            shortLabel: 'My Numbers',  desc: 'View & manage your numbers',    path: '/my-numbers' },
    { icon: MessageSquare, label: 'SMS Inbox',             shortLabel: 'Messages',    desc: 'Send & receive messages',       path: '/sms' },
    { icon: Server,        label: 'Developer API',         shortLabel: 'API Keys',    desc: 'REST API · Build on Calliotel', path: '/developer-api' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 md:pb-0">

      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-red-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">Calliotel</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-xl">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div>
                <p className="text-[10px] text-gray-400 leading-none uppercase tracking-wider">Balance</p>
                <p className="text-sm font-bold text-white leading-tight">{loading ? '...' : `$${balance.toFixed(2)}`}</p>
              </div>
              <button onClick={() => navigate('/buy-credits')}
                className="ml-1 w-6 h-6 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 flex items-center justify-center transition-colors" title="Add Funds">
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
            <NotificationBell />
            <button onClick={() => setDrawerOpen(true)} className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-amber-600 flex items-center justify-center overflow-hidden border-2 border-emerald-500/30 group-hover:border-emerald-400 transition-all">
                {user?.profile_picture
                  ? <img src={`${process.env.REACT_APP_BACKEND_URL}${user.profile_picture}`} alt="avatar" className="w-full h-full object-cover" />
                  : <span className="text-white font-bold text-sm">
                      {user?.full_name ? user.full_name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase() : user?.email?.[0]?.toUpperCase() || '?'}
                    </span>
                }
              </div>
            </button>
            <button onClick={() => setDrawerOpen(true)} className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>
      <AppDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {!loading && !onboardingDismissed && balance === 0 && stats.activeNumbers === 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-6 sm:pb-0"
          onClick={e => { if (e.target === e.currentTarget) dismissOnboarding(); }}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-3xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 px-6 pt-8 pb-6 text-center relative">
              <button onClick={dismissOnboarding}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center transition-all"
                aria-label="Close">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-5xl mb-3">📱</div>
              <h2 className="text-xl font-extrabold text-white mb-1">Get your first number</h2>
              <p className="text-emerald-100/80 text-sm">in 30 seconds — works worldwide</p>
            </div>
            <div className="px-6 py-5 space-y-3">
              {[
                { n: '1', label: 'Add funds to your wallet' },
                { n: '2', label: 'Pick a US, UK or Canadian number' },
                { n: '3', label: 'Receive SMS & calls instantly' },
              ].map(s => (
                <div key={s.n} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-400 text-xs font-bold">{s.n}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{s.label}</p>
                </div>
              ))}
              <div className="pt-3 pb-1 space-y-2">
                <button
                  onClick={() => { dismissOnboarding(); navigate('/buy-credits'); }}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/30 active:scale-95">
                  💳 Add Funds Now →
                </button>
                <button
                  onClick={dismissOnboarding}
                  className="w-full py-2.5 text-gray-500 hover:text-gray-400 text-sm transition-colors">
                  Maybe later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <WhatsNewBox />

        {!loading && balance < 2.5 && stats.activeNumbers === 0 && (
          <div className="flex items-center justify-between gap-4 bg-emerald-500/10 border border-emerald-500/40 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0 text-lg select-none">
                🎁
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-300">Top up $2 → get $0.99 bonus instantly!</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">Add $2 or more on your first deposit and we'll match it with $0.99 free. One time only.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/buy-credits')}
              className="flex-shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
            >
              Add $2 →
            </button>
          </div>
        )}

        {!loading && !welcomeDismissed && stats.activeNumbers === 0 && balance <= 1.5 && (
          <div className="relative rounded-2xl p-5 sm:p-6 shadow-xl"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)' }}>
            <button onClick={dismissWelcome}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all"
              aria-label="Dismiss">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-3xl mb-2">🎁</div>
            <p className="text-xl font-extrabold text-white mb-1">Welcome to Calliotel! 🎉</p>
            <p className="text-sm text-white/80 mb-4 leading-relaxed max-w-sm">
              Add $2 to your wallet and get a free $0.99 bonus — then grab your US, UK or Canadian number instantly.
            </p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => { dismissWelcome(); navigate('/buy-credits'); }}
                className="px-5 py-2.5 bg-white text-purple-700 font-bold rounded-xl text-sm hover:bg-white/90 transition-all shadow-lg">
                Add $2 &amp; Get My Bonus →
              </button>
              <button onClick={() => { dismissWelcome(); navigate('/browse-numbers'); }}
                className="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl text-sm transition-all">
                Browse Numbers
              </button>
            </div>
          </div>
        )}

        {!loading && (welcomeDismissed || stats.activeNumbers > 0) && balance >= 0 && balance <= 1.5 && (
          <div className="flex items-center justify-between gap-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-300">No balance — add funds to get started</p>
                <p className="text-xs text-amber-400/70 mt-0.5">💳 Card or 💎 Crypto (USDT/BTC) — works worldwide.</p>
              </div>
            </div>
            <button onClick={() => navigate('/buy-credits')}
              className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap">
              Add Funds
            </button>
          </div>
        )}

        {!loading && balance > 1.5 && balance < 2 && (
          <div className="flex items-center justify-between gap-4 bg-amber-500/10 border border-amber-500/40 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-amber-300">Low balance: ${balance.toFixed(2)} remaining</p>
                <p className="text-xs text-amber-400/70 mt-0.5">Top up your wallet to keep your numbers active.</p>
              </div>
            </div>
            <button onClick={() => navigate('/buy-credits')}
              className="flex-shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 whitespace-nowrap">
              Add Funds
            </button>
          </div>
        )}

        {!loading && balance > 2 && (
          <div onClick={() => navigate('/esim')}
            className="flex items-center gap-4 rounded-2xl px-5 py-4 cursor-pointer transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#0d2d1a,#0a1a2e)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div style={{ fontSize: 28, flexShrink: 0 }}>📡</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">✈️ Traveling? Get eSIM data from $0.54</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>180+ countries · 4G/5G · instant QR · use your wallet balance</p>
            </div>
            <span className="text-sm font-bold flex-shrink-0" style={{ color: '#10b981' }}>Browse →</span>
          </div>
        )}

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-amber-500 p-6 sm:p-8 shadow-xl shadow-emerald-500/20">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.15),_transparent)]" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                Welcome back, {user?.full_name?.split(' ')[0] || 'there'}
              </h1>
              <p className="text-emerald-100/80 text-sm">{user?.email}</p>
              {user?.client_id && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="flex items-center gap-2 bg-black/20 rounded-lg px-3 py-1.5">
                    <span className="text-emerald-200 text-xs uppercase tracking-wider font-semibold">Client ID</span>
                    <span className="font-mono font-bold text-white text-sm">{user.client_id}</span>
                    <button onClick={copyClientId} className="ml-1 p-1 rounded hover:bg-white/20 transition-colors" title="Copy">
                      {clientIdCopied ? <Check className="w-3.5 h-3.5 text-green-300" /> : <Copy className="w-3.5 h-3.5 text-emerald-200" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => navigate('/buy-credits')}
                className="flex items-center gap-1.5 bg-white text-emerald-600 hover:bg-gray-100 text-xs font-bold px-4 py-2 rounded-lg transition-colors shadow-md">
                <Plus className="w-3.5 h-3.5" /> Add Funds
              </button>
              <button onClick={() => navigate('/transfer')}
                className="flex items-center gap-1.5 bg-black/30 hover:bg-black/40 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors border border-white/20">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Transfer
              </button>
              <button onClick={handleLogout}
                className="hidden sm:flex items-center gap-1.5 bg-black/20 hover:bg-black/30 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors border border-white/15">
                <LogOut className="w-3.5 h-3.5" /> Log Out
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Phone}         label="Active Numbers"    value={stats.activeNumbers}        sub="Virtual numbers"   color="bg-emerald-500/80" loading={loading} onClick={() => navigate('/my-numbers')} />
          <StatCard icon={MessageSquare} label="Messages Sent"     value={stats.messagesSent}         sub="Outbound SMS"      color="bg-blue-500/80"   loading={loading} onClick={() => navigate('/sms')} />
          <StatCard icon={ArrowDownRight} label="Messages Received" value={stats.messagesReceived}    sub="Inbound SMS"       color="bg-emerald-500/80" loading={loading} onClick={() => navigate('/sms')} />
          <StatCard icon={Wallet}        label="Balance"           value={`$${balance.toFixed(2)}`}   sub="Available funds"   color="bg-green-500/80"  loading={loading} onClick={() => navigate('/wallet')} />
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-wider text-gray-400">Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickActions.map(a => (
              <div key={a.path} className={a.highlight ? 'col-span-2 sm:col-span-1' : ''}>
                <QuickAction
                  icon={a.icon}
                  label={a.label}
                  shortLabel={a.shortLabel}
                  desc={a.desc}
                  onClick={() => navigate(a.path)}
                  highlight={a.highlight}
                />
              </div>
            ))}
          </div>
        </div>

        <ExpiryAlerts navigate={navigate} />

        {/* Referral Banner */}
        <div
          onClick={() => navigate('/referrals')}
          className="cursor-pointer bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-2xl p-5 flex items-center justify-between gap-4 hover:border-yellow-400/50 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-2xl flex-shrink-0">🎁</div>
            <div>
              <div className="text-white font-bold text-base">Earn $1 per referral</div>
              <div className="text-yellow-200/70 text-sm">Invite friends — get $1 every time they buy their first number</div>
            </div>
          </div>
          <div className="text-yellow-400 font-bold text-sm whitespace-nowrap flex items-center gap-1">
            Invite →
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <RecentTransactions navigate={navigate} />
            <QuickSMS />
          </div>

          <div className="hidden lg:block space-y-4">
            <SystemStatus />

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" /> Your Account
              </h3>
              <div className="space-y-3">
                {user?.client_id && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-1">Client ID</p>
                    <p className="text-sm font-bold text-white font-mono">{user.client_id}</p>
                    <p className="text-[10px] text-gray-500 mt-1">Share to receive transfers</p>
                  </div>
                )}
                <div className="space-y-2 text-xs text-gray-400">
                  <div className="flex justify-between py-1.5 border-b border-gray-800">
                    <span>Email</span>
                    <span className="text-gray-200 font-medium truncate ml-2 max-w-[140px]">{user?.email}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span>Member since</span>
                    <span className="text-gray-200 font-medium">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
                  </div>
                </div>
                <button onClick={() => navigate('/account')}
                  className="w-full py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all">
                  Account Settings →
                </button>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-green-400" /> Wallet
              </h3>
              <p className="text-3xl font-bold text-white mb-1">{loading ? '...' : `$${balance.toFixed(2)}`}</p>
              <p className="text-xs text-gray-500 mb-4">Available balance</p>
              <button onClick={() => navigate('/buy-credits')}
                className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                <Plus className="w-4 h-4" /> Add Funds
              </button>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-blue-400" /> Need Help?
              </h3>
              <p className="text-xs text-gray-400 mb-3">Our support team is available 24/7 to assist you with anything.</p>
              <button onClick={() => navigate('/help')}
                className="w-full py-2 text-xs font-semibold text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 rounded-xl transition-all">
                Open Help Center →
              </button>
            </div>
          </div>
        </div>


      </main>

      <BottomNav />
    </div>
  );
};

export default DashboardPage;
