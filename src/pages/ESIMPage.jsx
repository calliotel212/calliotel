import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';
import { ExternalLink, ChevronRight, ArrowLeft, Search } from 'lucide-react';
import useGoBack from '../hooks/useGoBack';

const API = process.env.REACT_APP_BACKEND_URL || '';

const FLAG = {
  US:"🇺🇸", CA:"🇨🇦", GB:"🇬🇧", AU:"🇦🇺", DE:"🇩🇪", FR:"🇫🇷", JP:"🇯🇵",
  TR:"🇹🇷", CN:"🇨🇳", IN:"🇮🇳", SG:"🇸🇬", TH:"🇹🇭", ID:"🇮🇩", AE:"🇦🇪",
  SA:"🇸🇦", EG:"🇪🇬", MX:"🇲🇽", BR:"🇧🇷", PH:"🇵🇭", KR:"🇰🇷", IT:"🇮🇹",
  ES:"🇪🇸", NL:"🇳🇱", SE:"🇸🇪", PL:"🇵🇱", MY:"🇲🇾", VN:"🇻🇳", HK:"🇭🇰",
  MO:"🇲🇴", NZ:"🇳🇿", ZA:"🇿🇦", AR:"🇦🇷", CL:"🇨🇱", CO:"🇨🇴", PT:"🇵🇹",
  GR:"🇬🇷", AT:"🇦🇹", BE:"🇧🇪", CH:"🇨🇭", CZ:"🇨🇿", DK:"🇩🇰", FI:"🇫🇮",
  HU:"🇭🇺", IE:"🇮🇪", NO:"🇳🇴", RO:"🇷🇴", SK:"🇸🇰", UA:"🇺🇦", EU:"🌍",
  GLOBAL:"🌐",
};

const QUICK_FILTERS = [
  { code: '', label: '🌐 All' },
  { code: 'US', label: '🇺🇸 USA' },
  { code: 'GB', label: '🇬🇧 UK' },
  { code: 'CA', label: '🇨🇦 Canada' },
  { code: 'AU', label: '🇦🇺 Australia' },
  { code: 'JP', label: '🇯🇵 Japan' },
  { code: 'KR', label: '🇰🇷 Korea' },
  { code: 'SG', label: '🇸🇬 Singapore' },
  { code: 'TH', label: '🇹🇭 Thailand' },
  { code: 'AE', label: '🇦🇪 UAE' },
  { code: 'TR', label: '🇹🇷 Turkey' },
  { code: 'IN', label: '🇮🇳 India' },
  { code: 'DE', label: '🇩🇪 Germany' },
  { code: 'FR', label: '🇫🇷 France' },
];

function fmtData(mb) {
  if (!mb) return "0 MB";
  return mb >= 1024 ? `${(mb / 1024).toFixed(0)} GB` : `${mb} MB`;
}

export default function ESIMPage() {
  const { user, balance, refreshBalance } = useAuth();
  const navigate = useNavigate();
  const goBack = useGoBack('/account');
  const { toast } = useToast();

  const [mode, setMode] = useState('new'); // 'new' | 'topup'
  const [location, setLocation] = useState('');
  const [packages, setPackages] = useState([]);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [buying, setBuying] = useState(null);
  const [result, setResult] = useState(null);

  const [myOrders, setMyOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [query, setQuery] = useState('');

  const fetchPackages = useCallback(async (loc, isTopup) => {
    setLoadingPkgs(true);
    try {
      const params = new URLSearchParams();
      if (loc) params.append('location', loc);
      if (isTopup) params.append('type', 'TOPUP');
      const res = await axios.get(`${API}/api/esim/packages?${params.toString()}`);
      setPackages(res.data.packages || []);
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to load eSIM plans', variant: 'destructive' });
    } finally {
      setLoadingPkgs(false);
    }
  }, [toast]);

  useEffect(() => {
    if (mode === 'new') {
      fetchPackages(location, false);
    } else if (mode === 'topup' && selectedOrder) {
      fetchPackages(location || selectedOrder.locationCode, true);
    }
  }, [mode, location, selectedOrder, fetchPackages]);

  useEffect(() => {
    if (mode === 'topup' && myOrders.length === 0) {
      const fetchOrders = async () => {
        setLoadingOrders(true);
        try {
          const token = safeLocalStorage.getItem('token');
          if (!token) {
            setLoadingOrders(false);
            return;
          }
          const res = await axios.get(`${API}/api/esim/my-orders`, { headers: { Authorization: `Bearer ${token}` } });
          setMyOrders(res.data.orders || []);
        } catch (e) {
        } finally {
          setLoadingOrders(false);
        }
      };
      fetchOrders();
    }
  }, [mode, myOrders.length]);

  const handleBuy = async (pkg) => {
    if (!user) { navigate('/login'); return; }
    if (parseFloat(balance || 0) < pkg.retailPrice) { navigate('/add-funds'); return; }
    setBuying(pkg.packageCode);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(
        `${API}/api/esim/order`,
        { packageCode: pkg.packageCode, quantity: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResult(res.data);
      refreshBalance();
    } catch (e) {
      toast({ title: 'Purchase failed', description: e.response?.data?.detail || 'Something went wrong', variant: 'destructive' });
    } finally {
      setBuying(null);
    }
  };

  const handleTopup = async (pkg) => {
    if (!user) { navigate('/login'); return; }
    if (parseFloat(balance || 0) < pkg.retailPrice) { navigate('/add-funds'); return; }
    setBuying(pkg.packageCode);
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/api/esim/topup`, {
        orderNo: selectedOrder.orderNo,
        iccid: selectedOrder.esims?.[0]?.iccid,
        packageCode: pkg.packageCode
      }, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Recharge successful!', description: 'Your eSIM has been topped up.' });
      refreshBalance();
      setSelectedOrder(null);
      setMode('new');
      setTimeout(() => navigate('/my-esims'), 800);
    } catch (e) {
      toast({ 
        title: 'Recharge unavailable', 
        description: e.response?.status === 404 ? 'eSIM recharge is being enabled. Please try again shortly.' : (e.response?.data?.detail || 'Top-up failed. Please try again later.'),
        variant: 'destructive' 
      });
    } finally {
      setBuying(null);
    }
  };

  if (result) {
    const esim = result.esims?.[0] || {};
    const qr = esim.qrCodeUrl || esim.activationCode || esim.lpa;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-[var(--bg-page)] pb-28 relative">
        <div className="max-w-[420px] w-full bg-[var(--bg-card)] rounded-[20px] border border-[var(--border-1)] p-7 text-center">
          <div className="text-[48px] mb-2">✅</div>
          <div className="text-xl font-extrabold text-[var(--text-1)] mb-1.5">eSIM Activated!</div>
          <div className="text-[13px] text-[var(--text-2)] mb-5">
            Scan the QR code with your phone's camera to install instantly
          </div>
          {qr && qr.startsWith('http') ? (
            <img src={qr} alt="eSIM QR" className="w-[200px] h-[200px] rounded-xl border-2 border-[#10b981] mb-4 mx-auto" />
          ) : qr ? (
             <div className="bg-white rounded-xl p-4 inline-block mb-4">
               <div className="font-mono text-[11px] text-black break-all max-w-[220px]">{qr}</div>
             </div>
          ) : (
             <div className="text-[13px] text-[var(--text-2)] mb-4">
               QR code will arrive by email within minutes
             </div>
          )}
          <div className="text-xs text-[var(--text-2)] mb-5">
            Order #: <span className="text-[var(--text-1)]">{result.orderNo}</span>
          </div>
          <div className="flex gap-2.5 justify-center">
            <button onClick={() => navigate('/my-esims')} className="bg-[#10b981] text-white rounded-[10px] px-5 py-2.5 font-bold text-sm hover:opacity-80 transition-opacity">
              My eSIMs
            </button>
            <button onClick={() => setResult(null)} className="bg-[#a855f7] text-white rounded-[10px] px-5 py-2.5 font-bold text-sm hover:opacity-80 transition-opacity">
              Browse More
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--bg-page)] text-[var(--text-1)] pb-28">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-8 pb-3 mb-2 max-w-lg mx-auto gap-3">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="w-10 h-10 rounded-xl bg-[var(--bg-card)] border border-[var(--border-1)] flex items-center justify-center flex-shrink-0 hover:opacity-80 active:scale-95 transition-all"
          >
            <ArrowLeft size={18} className="text-[var(--text-1)]" />
          </button>
          <span className="text-[28px] flex-shrink-0">📡</span>
          <div className="min-w-0">
            <h1 className="text-[20px] font-extrabold text-[var(--text-1)] leading-tight truncate">eSIM Data Plans</h1>
            <p className="text-xs text-[var(--text-2)] mt-0.5">180+ countries · 4G/5G · Instant QR</p>
          </div>
        </div>
        <button onClick={() => navigate('/my-esims')} className="flex items-center gap-1.5 bg-[#a855f7] rounded-[10px] px-3.5 py-2 transition-opacity hover:opacity-80 flex-shrink-0">
          <span className="text-[13px] font-bold text-white">My eSIMs</span>
          <ExternalLink size={13} color="#fff" />
        </button>
      </div>

      <div className="max-w-lg mx-auto">
        {/* Compat note */}
        <div className="flex items-start gap-2 mx-4 mb-3 bg-[#3b82f614] border border-[#3b82f633] rounded-[10px] p-2.5">
          <span className="text-base mt-0.5">📱</span>
          <p className="text-[11px] text-[var(--text-2)] leading-[17px] flex-1">
            <span className="text-[#60a5fa] font-bold">Compatible: </span>
            iPhone XS+ · Samsung S20+ · Pixel 3+<br/>
            Check Settings → About → look for "EID"
          </p>
        </div>

        {/* Steps */}
        <div className="flex justify-around mx-4 mb-3 bg-[var(--bg-card)] rounded-xl p-2.5 border border-[var(--border-1)]">
          {[
            { icon: "🛒", label: "Pick plan" },
            { icon: "💳", label: "Pay with wallet" },
            { icon: "📷", label: "Scan QR" },
            { icon: "🚀", label: "Connected!" },
          ].map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-[18px]">{step.icon}</span>
              <span className="text-[10px] text-[var(--text-2)] font-semibold">{step.label}</span>
            </div>
          ))}
        </div>

        {/* Mode Toggle */}
        <div className="mx-4 mb-3 flex bg-[var(--bg-card)] rounded-xl p-1 border border-[var(--border-1)]">
          <button 
            onClick={() => { setMode('new'); setLocation(''); }}
            className={`flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-colors ${mode === 'new' ? 'bg-[#a855f7] text-white' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'}`}
          >
            Buy New eSIM
          </button>
          <button 
            onClick={() => { setMode('topup'); setLocation(''); setSelectedOrder(null); }}
            className={`flex-1 py-1.5 text-[13px] font-bold rounded-lg transition-colors ${mode === 'topup' ? 'bg-[#a855f7] text-white' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'}`}
          >
            Recharge Existing
          </button>
        </div>

        {/* Top-up Selection */}
        {mode === 'topup' && !selectedOrder && (
          <div className="mx-4 mb-10">
            <h2 className="text-lg font-bold text-[var(--text-1)] mb-3 mt-4">Select eSIM to Recharge</h2>
            {loadingOrders ? (
              <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-[#a855f7]" /></div>
            ) : myOrders.length === 0 ? (
              <div className="text-center py-10 text-[var(--text-2)] text-sm">No eSIMs found. Buy a new eSIM first.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {myOrders.map(order => (
                  <div key={order.orderNo} onClick={() => setSelectedOrder(order)} className="bg-[var(--bg-card)] border border-[var(--border-1)] rounded-[14px] p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors">
                    <div>
                      <div className="font-bold text-[var(--text-1)] text-[15px] mb-1">{order.packageName || order.packageCode}</div>
                      <div className="text-xs text-[var(--text-2)]">Order #{order.orderNo}</div>
                    </div>
                    <ChevronRight size={20} className="text-[var(--text-2)]" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected Top-up Display */}
        {mode === 'topup' && selectedOrder && (
          <div className="mx-4 mb-4 bg-[#10b98115] border border-[#10b98140] rounded-[14px] p-3 flex items-center justify-between mt-4">
            <div>
              <div className="text-xs text-[#10b981] font-bold mb-0.5">Recharging eSIM</div>
              <div className="text-[14px] font-semibold text-[var(--text-1)]">{selectedOrder.packageName || selectedOrder.packageCode}</div>
            </div>
            <button onClick={() => setSelectedOrder(null)} className="text-xs text-[#10b981] font-bold px-2 py-1 bg-[#10b98120] rounded-md transition-opacity hover:opacity-80">Change</button>
          </div>
        )}

        {/* Search + Filters */}
        { (mode === 'new' || (mode === 'topup' && selectedOrder)) && (
          <div className="mx-4 mb-3 relative">
            <input
              type="search"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                if (v.trim()) setLocation('');
              }}
              placeholder="Search country or plan — Spain, Japan, 3GB…"
              autoComplete="off"
              className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-1)', color: 'var(--text-1)' }}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: '#a855f7' }} />
          </div>
        )}
        { (mode === 'new' || (mode === 'topup' && selectedOrder)) && (
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 mb-2 no-scrollbar">
            {QUICK_FILTERS.map(f => (
              <button
                key={f.code}
                onClick={() => { setLocation(f.code); setQuery(''); }}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors border ${
                  location === f.code 
                    ? 'bg-[#a855f7] text-white border-[#a855f7]' 
                    : 'bg-[var(--bg-card)] text-[var(--text-2)] border-[var(--border-1)] hover:text-[var(--text-1)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}

        {/* List */}
        { (mode === 'new' || (mode === 'topup' && selectedOrder)) && (() => {
          const q = query.trim().toLowerCase();
          const visible = !q ? packages : packages.filter((item) => {
            const code = (item.locationCode || '').split('-')[0].split(',')[0];
            const chip = QUICK_FILTERS.find((f) => f.code === code);
            const hay = [
              item.name,
              item.locationName,
              item.locationCode,
              chip?.label,
            ].filter(Boolean).join(' ').toLowerCase();
            return hay.includes(q);
          });
          if (loadingPkgs) {
            return <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent border-[#a855f7]" /></div>;
          }
          if (visible.length === 0) {
            return (
              <div className="text-center py-10 text-[var(--text-2)] text-sm">
                {q ? `No plans match “${query.trim()}”. Try another country.` : 'No plans available right now.'}
              </div>
            );
          }
          return visible.map(item => {
              const is5g = (item.speed || "").includes("5G");
              const code = (item.locationCode || '').split('-')[0].split(',')[0];
              return (
                <div key={item.packageCode} className="flex items-center gap-3 bg-[var(--bg-card)] rounded-[14px] border border-[var(--border-1)] p-[14px] mb-2.5 mx-4">
                  <div className="text-[30px] flex-shrink-0">{FLAG[code] || "🌐"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[var(--text-1)] mb-1 truncate">
                      {item.name || `${item.locationName} ${fmtData(item.dataAmount)}`}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="bg-[#10b9811f] rounded-md px-[7px] py-[2px]">
                        <span className="text-[11px] font-bold text-[#10b981]">{fmtData(item.dataAmount)}</span>
                      </div>
                      <span className="text-[11px] text-[var(--text-2)]">{item.duration}d</span>
                      <div className={`rounded-[5px] px-1.5 py-[1px] ${is5g ? 'bg-[#8b5cf626]' : 'bg-[#3b82f61f]'}`}>
                        <span className={`text-[10px] font-bold ${is5g ? 'text-[#a78bfa]' : 'text-[#60a5fa]'}`}>
                          {is5g ? "5G" : "4G"}
                        </span>
                      </div>
                      {item.supportTopup && mode === 'new' && (
                        <span className="text-[10px] text-[#fbbf24] bg-[#fbbf241a] px-1.5 py-[1px] rounded-[5px] font-semibold">
                          Top-up ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-base font-extrabold text-[#a855f7]">${item.retailPrice.toFixed(2)}</span>
                    <button 
                      onClick={() => mode === 'new' ? handleBuy(item) : handleTopup(item)}
                      disabled={buying === item.packageCode}
                      className="bg-[#a855f7] rounded-lg px-[14px] py-1.5 disabled:opacity-50 transition-opacity hover:opacity-80"
                    >
                      <span className="text-xs font-bold text-white">
                        {buying === item.packageCode ? "..." : (mode === 'new' ? "Get" : "Top-up")}
                      </span>
                    </button>
                  </div>
                </div>
              );
            });
        })()}
      </div>
      <BottomNav />
    </div>
  );
}
