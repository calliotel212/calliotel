import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Globe, Search, Filter, Shield, Zap, Check, ArrowRight, Loader, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';

const BACKEND = process.env.REACT_APP_BACKEND_URL;

const COUNTRY_FLAGS = {
  US:'🇺🇸',GB:'🇬🇧',UK:'🇬🇧',CA:'🇨🇦',AU:'🇦🇺',DE:'🇩🇪',FR:'🇫🇷',
  ES:'🇪🇸',IT:'🇮🇹',NL:'🇳🇱',SE:'🇸🇪',NO:'🇳🇴',DK:'🇩🇰',FI:'🇫🇮',
  PL:'🇵🇱',BE:'🇧🇪',CH:'🇨🇭',AT:'🇦🇹',IE:'🇮🇪',NZ:'🇳🇿',SG:'🇸🇬',
  HK:'🇭🇰',JP:'🇯🇵',KR:'🇰🇷',IN:'🇮🇳',BR:'🇧🇷',MX:'🇲🇽',AR:'🇦🇷',
  ZA:'🇿🇦',AE:'🇦🇪',TR:'🇹🇷',IL:'🇮🇱',LB:'🇱🇧',
};

export default function NumberPoolPage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { toast } = useToast();

  const [countries, setCountries] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [numberType, setNumberType] = useState('');
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [myNumbers, setMyNumbers] = useState([]);
  const [tab, setTab] = useState('browse'); // browse | my-numbers

  useEffect(() => { fetchCountries(); }, []);
  useEffect(() => { fetchNumbers(); }, [selectedCountry, numberType, page]);
  useEffect(() => { if (user) fetchMyNumbers(); }, [user]);

  const fetchCountries = async () => {
    try {
      const r = await axios.get(`${BACKEND}/api/pool/countries`);
      setCountries(r.data.countries || []);
    } catch {}
  };

  const fetchNumbers = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 18 };
      if (selectedCountry) params.country = selectedCountry;
      if (numberType) params.number_type = numberType;
      const r = await axios.get(`${BACKEND}/api/pool/numbers`, { params });
      setNumbers(r.data.numbers || []);
      setTotal(r.data.total || 0);
    } catch {
      setNumbers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyNumbers = async () => {
    try {
      const r = await axios.get(`${BACKEND}/api/pool/my-numbers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMyNumbers(r.data.subscriptions || []);
    } catch {}
  };

  const handlePurchase = async (number) => {
    if (!user) { navigate('/login'); return; }
    setPurchasing(number.phone_number);
    try {
      const poolRes = await axios.post(`${BACKEND}/api/pool/purchase`,
        { phone_number: number.phone_number, auto_renew: true },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: '✅ Number Activated!', description: `${number.phone_number} is now yours.` });
      try {
        const { trackPurchase } = await import('../utils/gtagConversions');
        trackPurchase({
          value: number.monthly_price || number.price || poolRes.data?.price || 1.0,
          currency: 'USD',
          transactionId: poolRes.data?.subscription_id || number.phone_number || '',
        });
      } catch (e) { /* tracking failure must never break UX */ }
      fetchNumbers();
      fetchMyNumbers();
      setTab('my-numbers');
    } catch (e) {
      toast({
        title: 'Purchase failed',
        description: e.response?.data?.detail || 'Try again.',
        variant: 'destructive'
      });
    } finally {
      setPurchasing(null);
    }
  };

  const handleCancel = async (subId) => {
    try {
      await axios.post(`${BACKEND}/api/pool/cancel/${subId}`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast({ title: 'Cancelled', description: 'Subscription cancelled. Number stays active until renewal.' });
      fetchMyNumbers();
    } catch (e) {
      toast({ title: 'Error', description: e.response?.data?.detail, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-red-600 flex items-center justify-center">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-white tracking-tight">CALLIOTEL</span>
          </div>
          <div className="flex items-center gap-2">
            {user
              ? <button onClick={() => navigate('/sms')} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-semibold transition-colors">Home</button>
              : <button onClick={() => navigate('/signup')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-sm font-semibold transition-colors">Sign Up Free</button>
            }
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-b from-gray-900/60 to-gray-950 py-14 border-b border-gray-800/60">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full mb-5">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-emerald-400 text-sm font-semibold">Numbers Available Now</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black mb-4">
            Get Your Own{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-amber-400">
              Virtual Number
            </span>
          </h1>
          <p className="text-gray-400 text-lg mb-6">
            Real phone numbers from multiple countries. Receive SMS, calls & verifications instantly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-5 text-sm text-gray-500">
            <span className="flex items-center gap-1.5"><Shield className="w-4 h-4 text-green-400" /> Private & Secure</span>
            <span className="flex items-center gap-1.5"><Zap className="w-4 h-4 text-emerald-400" /> Instant Activation</span>
            <span className="flex items-center gap-1.5"><RefreshCw className="w-4 h-4 text-blue-400" /> Auto-Renews Monthly</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          <button onClick={() => setTab('browse')}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === 'browse' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <Globe className="w-4 h-4 inline mr-2" />Browse Numbers
          </button>
          <button onClick={() => { setTab('my-numbers'); if (user) fetchMyNumbers(); else navigate('/login'); }}
            className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${tab === 'my-numbers' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            <Phone className="w-4 h-4 inline mr-2" />My Numbers
            {myNumbers.length > 0 && <span className="ml-2 bg-white/20 px-1.5 py-0.5 rounded-full text-xs">{myNumbers.length}</span>}
          </button>
        </div>

        {tab === 'browse' && (
          <>
            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-6">
              {/* Country filter */}
              <div className="relative">
                <select value={selectedCountry} onChange={e => { setSelectedCountry(e.target.value); setPage(1); }}
                  className="appearance-none bg-gray-800 border border-gray-700 text-white px-4 py-2.5 pr-10 rounded-xl text-sm focus:border-emerald-500 focus:outline-none cursor-pointer">
                  <option value="">🌍 All Countries</option>
                  {countries.map(c => (
                    <option key={c.country_code} value={c.country_code}>
                      {c.flag || COUNTRY_FLAGS[c.country_code] || '🌍'} {c.country_name} ({c.count})
                    </option>
                  ))}
                </select>
                <Filter className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>

              {/* Type filter */}
              <select value={numberType} onChange={e => { setNumberType(e.target.value); setPage(1); }}
                className="appearance-none bg-gray-800 border border-gray-700 text-white px-4 py-2.5 rounded-xl text-sm focus:border-emerald-500 focus:outline-none cursor-pointer">
                <option value="">All Types</option>
                <option value="local">Local</option>
                <option value="mobile">Mobile</option>
                <option value="toll_free">Toll Free</option>
              </select>

              <button onClick={() => { setSelectedCountry(''); setNumberType(''); setPage(1); }}
                className="px-4 py-2.5 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white rounded-xl text-sm transition-colors">
                Reset
              </button>

              <span className="ml-auto text-gray-500 text-sm self-center">{total} number{total !== 1 ? 's' : ''} available</span>
            </div>

            {/* Country pills */}
            {countries.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => { setSelectedCountry(''); setPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedCountry === '' ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                  All
                </button>
                {countries.slice(0, 12).map(c => (
                  <button key={c.country_code} onClick={() => { setSelectedCountry(c.country_code); setPage(1); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedCountry === c.country_code ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                    {c.flag || COUNTRY_FLAGS[c.country_code] || '🌍'} {c.country_code} · {c.count}
                  </button>
                ))}
              </div>
            )}

            {/* Number grid */}
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="w-8 h-8 text-emerald-400 animate-spin" />
              </div>
            ) : numbers.length === 0 ? (
              <div className="text-center py-20">
                <Phone className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 text-lg font-semibold mb-2">No numbers available yet</p>
                <p className="text-gray-600 text-sm">We're stocking up our inventory. Check back soon!</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {numbers.map((n, i) => (
                  <div key={i} className="bg-gray-900/60 border border-gray-800/60 rounded-2xl p-5 hover:border-emerald-500/40 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{n.flag || COUNTRY_FLAGS[n.country_code] || '🌍'}</div>
                        <div>
                          <p className="text-white font-bold">{n.phone_number}</p>
                          <p className="text-gray-500 text-xs">{n.country_name} · {n.city || n.number_type}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${n.number_type === 'mobile' ? 'bg-blue-500/20 text-blue-400' : n.number_type === 'toll_free' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-700 text-gray-400'}`}>
                        {n.number_type}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(n.features || []).map((f, fi) => (
                        <span key={fi} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3 text-green-400" />{f}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-black text-white">${n.sell_price?.toFixed(2)}</p>
                        <p className="text-gray-500 text-xs">per month</p>
                      </div>
                      <button onClick={() => handlePurchase(n)}
                        disabled={purchasing === n.phone_number}
                        className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-amber-500 hover:from-emerald-400 hover:to-amber-400 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                        {purchasing === n.phone_number ? <Loader className="w-4 h-4 animate-spin" /> : <>Get It <ArrowRight className="w-4 h-4" /></>}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {total > 18 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-4 py-2 bg-gray-800 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-gray-700 transition-colors">
                  ← Prev
                </button>
                <span className="text-gray-400 text-sm">Page {page} of {Math.ceil(total / 18)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 18)}
                  className="px-4 py-2 bg-gray-800 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-gray-700 transition-colors">
                  Next →
                </button>
              </div>
            )}
          </>
        )}

        {tab === 'my-numbers' && (
          <div>
            {myNumbers.length === 0 ? (
              <div className="text-center py-20">
                <Phone className="w-14 h-14 text-gray-700 mx-auto mb-4" />
                <p className="text-gray-400 text-lg font-semibold mb-2">No active numbers</p>
                <p className="text-gray-600 text-sm mb-6">Browse our inventory and get your first virtual number.</p>
                <button onClick={() => setTab('browse')} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl transition-all">
                  Browse Numbers →
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {myNumbers.map((s, i) => (
                  <div key={i} className={`bg-gray-900/60 border rounded-2xl p-5 ${s.status === 'active' ? 'border-green-500/30' : 'border-gray-800/60 opacity-60'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="text-3xl">{s.flag || COUNTRY_FLAGS[s.country_code] || '🌍'}</div>
                        <div>
                          <p className="text-white font-bold">{s.phone_number}</p>
                          <p className="text-gray-500 text-xs">{s.country_name}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                        {s.status}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                      <div className="flex justify-between">
                        <span>Monthly price</span>
                        <span className="text-white font-semibold">${s.monthly_price?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Next renewal</span>
                        <span className="text-gray-300">{new Date(s.next_renewal_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Auto-renew</span>
                        <span className={s.auto_renew ? 'text-green-400' : 'text-gray-400'}>{s.auto_renew ? 'On' : 'Off'}</span>
                      </div>
                    </div>

                    {s.status === 'active' && (
                      <button onClick={() => handleCancel(s.subscription_id)}
                        className="w-full py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-semibold transition-all">
                        Cancel Subscription
                      </button>
                    )}
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
