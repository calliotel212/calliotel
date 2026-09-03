import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, MessageSquare, Phone, PhoneOff, AlertOctagon, 
  AlertTriangle, ChevronRight, Copy, CheckCircle, RefreshCw, XCircle, Clock, X, ArrowLeft 
} from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';
import BottomNav from '../components/BottomNav';
import useGoBack from '../hooks/useGoBack';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const REFUND_MIN_SECONDS = 120;

const InfoRow = ({ label, value, valueColor, valueBold }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-dashed border-[var(--border-1)]">
    <span className="text-[13px] font-semibold text-[var(--text-2)]">{label}</span>
    <span className={`text-[14px] max-w-[60%] text-right truncate ${valueBold ? 'font-extrabold' : 'font-semibold'} ${valueColor || 'text-[var(--text-1)]'}`}>
      {value}
    </span>
  </div>
);

const TimerPill = ({ label, value, color, icon: Icon }) => (
  <div className="flex-1 p-2.5 rounded-[10px] border bg-[var(--bg-card-2)]" style={{ borderColor: color + '44' }}>
    <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[var(--text-2)] mb-1">{label}</p>
    <div className="flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-[16px] font-extrabold font-mono" style={{ color }}>{value}</span>
    </div>
  </div>
);

const OtpOrderCard = ({ order, onRefund, onCheck, onBuyNew }) => {
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [busyRefund, setBusyRefund] = useState(false);
  const [now, setNow] = useState(Date.now());

  const isActive = order.status === 'active';
  const hasCode = !!order.sms_code;
  const isCancelled = order.status === 'cancelled';

  useEffect(() => {
    if (!isActive || hasCode) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActive, hasCode]);

  const created = order.created_at ? new Date(order.created_at).getTime() : null;
  const expires = order.expires_at ? new Date(order.expires_at).getTime() : null;
  const elapsed = created ? Math.max(0, Math.floor((now - created) / 1000)) : 0;
  const refundEligibleIn = Math.max(0, REFUND_MIN_SECONDS - elapsed);
  const expiresIn = expires ? Math.max(0, Math.floor((expires - now) / 1000)) : null;

  const fmt = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;

  const dateStr = (() => {
    if (!order.created_at) return "—";
    const d = new Date(order.created_at);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()} ${months[d.getMonth()]} ${String(d.getFullYear()).slice(-2)} · ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  })();

  const copyPhone = async () => {
    if (!order.phone_number) return;
    navigator.clipboard.writeText(order.phone_number).catch(() => {});
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 1500);
  };

  const copyCode = async () => {
    if (!order.sms_code) return;
    navigator.clipboard.writeText(order.sms_code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  const handleRefund = async () => {
    setBusyRefund(true);
    await onRefund(order.order_code);
    setBusyRefund(false);
  };

  return (
    <div className={`rounded-[18px] p-4 mb-3.5 border shadow-sm ${
      hasCode ? 'border-emerald-500 shadow-[0_4px_16px_rgba(16,185,129,0.15)] bg-[var(--bg-card)]' :
      isCancelled ? 'border-red-500/30 bg-[var(--bg-card)]' :
      'border-[var(--border-1)] bg-[var(--bg-card)] shadow-black/5'
    }`}>
      <h3 className="text-center text-[15px] font-bold text-[var(--text-1)] mb-3.5">Order Nº{order.order_code}</h3>

      <InfoRow label="Date" value={dateStr} />
      <InfoRow label="Service" value={order.service_name || order.service_slug || '—'} />
      <InfoRow label="Country" value={order.country_name || order.country_code || '—'} />
      <InfoRow label="Operator" value={order.operator || order.provider || 'Virtual'} />
      <InfoRow label="Price" value={`$${(order.price ?? 0).toFixed(4)}`} valueColor="text-emerald-500" valueBold />

      <p className="text-[12px] font-semibold text-[var(--text-2)] mt-4 mb-2 uppercase tracking-wider">Number</p>
      <button onClick={copyPhone} className="w-full flex items-stretch rounded-xl border border-primary/40 overflow-hidden bg-[#0a0f1f]">
        <div className="w-[50px] flex items-center justify-center bg-primary/20">
          <Copy className="w-5 h-5 text-primary" />
        </div>
        <div className={`flex-1 text-center py-3.5 text-[20px] font-extrabold font-mono tracking-widest ${copiedPhone ? 'text-emerald-500' : 'text-white'}`}>
          {copiedPhone ? '✓ Copied!' : (order.phone_number || '—')}
        </div>
        <div className="w-[50px] flex items-center justify-center bg-primary/20">
          <Copy className="w-5 h-5 text-primary" />
        </div>
      </button>

      {hasCode && (
        <>
          <p className="text-[12px] font-semibold text-[var(--text-2)] mt-4 mb-2 uppercase tracking-wider">Code from SMS</p>
          <button onClick={copyCode} className="w-full flex items-center justify-between py-4 px-[18px] rounded-xl border border-emerald-500 bg-emerald-500/10">
            <span className="flex-1 text-center text-[32px] font-black font-mono tracking-[6px] text-emerald-500">
              {order.sms_code}
            </span>
            {copiedCode ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <Copy className="w-6 h-6 text-emerald-500" />}
          </button>
          {order.full_message && order.full_message !== order.sms_code && (
            <p className="text-[11px] text-[var(--text-2)] mt-1.5 px-1 leading-relaxed">
              {order.full_message}
            </p>
          )}
        </>
      )}

      {isActive && !hasCode && (
        <div className="mt-3.5 p-3.5 rounded-xl border border-[var(--border-1)] bg-[var(--bg-card-2)] text-center">
          <p className="text-[14px] font-bold text-[var(--text-1)] mb-1">Can't receive OTP?</p>
          <p className="text-[12px] text-[var(--text-2)] leading-relaxed">
            Use a different browser or device for sign-up. If no SMS in 2 min, refund and try a new number — instant wallet credit.
          </p>
        </div>
      )}

      <div className="flex justify-between items-center mt-3.5 pt-3 border-t border-dashed border-[var(--border-1)]">
        <span className="text-[13px] font-semibold text-[var(--text-2)]">Status</span>
        <div className="flex items-center gap-1.5">
          {isCancelled && <><XCircle className="w-4 h-4 text-red-500" /><span className="text-[14px] font-bold text-red-500">Cancelled — Refunded</span></>}
          {hasCode && <><CheckCircle className="w-4 h-4 text-emerald-500" /><span className="text-[14px] font-bold text-emerald-500">SMS Received</span></>}
          {isActive && !hasCode && <><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /><span className="text-[14px] font-bold text-amber-500">Waiting for SMS</span></>}
        </div>
      </div>

      {isActive && !hasCode && (
        <div className="flex gap-2.5 mt-3">
          <TimerPill label="Auto-expires in" value={expiresIn != null ? fmt(expiresIn) : '—'} color={expiresIn != null && expiresIn < 180 ? '#ef4444' : '#a0a0b0'} icon={Clock} />
          <TimerPill label={refundEligibleIn === 0 ? 'Refund available' : 'Refund eligible in'} value={refundEligibleIn === 0 ? 'NOW' : fmt(refundEligibleIn)} color={refundEligibleIn === 0 ? '#10b981' : '#f59e0b'} icon={refundEligibleIn === 0 ? CheckCircle : Clock} />
        </div>
      )}

      {isActive && !hasCode && (
        <div className="flex gap-2.5 mt-3.5">
          <button onClick={() => onCheck(order.order_code)} className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-[10px] border border-primary/30 bg-primary/10 transition-colors active:bg-primary/20">
            <RefreshCw className="w-4 h-4 text-primary" />
            <span className="text-[14px] font-extrabold text-primary">Check SMS</span>
          </button>
          <button
            disabled={refundEligibleIn > 0 || busyRefund}
            onClick={handleRefund}
            className={`flex-1 flex items-center justify-center gap-1.5 py-3 rounded-[10px] transition-colors ${
              refundEligibleIn > 0 ? 'bg-red-500/10 text-red-500' : 'bg-red-500 text-white hover:bg-red-600'
            } ${busyRefund ? 'opacity-60' : 'opacity-100'}`}
          >
            <X className="w-4 h-4" />
            <span className="text-[14px] font-extrabold">
              {busyRefund ? 'Refunding…' : refundEligibleIn > 0 ? `Refund in ${fmt(refundEligibleIn)}` : 'Refund Now'}
            </span>
          </button>
        </div>
      )}

      {!isActive && (
        <button onClick={onBuyNew} className="mt-4 w-full flex items-center justify-center gap-1.5 py-3.5 rounded-xl bg-primary text-white shadow-[0_4px_8px_rgba(0,0,0,0.3)] transition-transform active:scale-95">
          <span className="text-[15px] font-extrabold">Buy new number</span>
          <ChevronRight className="w-[18px] h-[18px]" />
        </button>
      )}
    </div>
  );
};

const MyNumbersPage = () => {
  const [view, setView] = useState('permanent'); // bought numbers first; 'otp' | 'permanent'
  const [otpOrders, setOtpOrders] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [loadingOtp, setLoadingOtp] = useState(true);
  const [loadingNums, setLoadingNums] = useState(true);
  const [copiedNum, setCopiedNum] = useState(null);
  
  const [bridgePhoneInvalid, setBridgePhoneInvalid] = useState(false);
  const [bridgePhoneIsCalliotel, setBridgePhoneIsCalliotel] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const goBack = useGoBack('/account');
  const pollRef = useRef(null);

  const loadBridgePhoneValidity = async () => {
    try {
      const token = safeLocalStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API}/calls/bridge-phone`, { headers: { Authorization: `Bearer ${token}` } });
      const { bridge_phone, is_valid, is_calliotel_number } = res.data;
      if (bridge_phone && is_calliotel_number) {
        setBridgePhoneIsCalliotel(true);
        setBridgePhoneInvalid(false);
      } else if (bridge_phone && is_valid === false) {
        setBridgePhoneInvalid(true);
        setBridgePhoneIsCalliotel(false);
      } else {
        setBridgePhoneInvalid(false);
        setBridgePhoneIsCalliotel(false);
      }
    } catch {}
  };

  const loadOtp = async () => {
    try {
      const token = safeLocalStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API}/verification/my-orders`, { headers: { Authorization: `Bearer ${token}` } });
      const list = Array.isArray(res.data) ? res.data : (res.data.orders ?? []);
      setOtpOrders(list);
    } catch {
    } finally {
      setLoadingOtp(false);
    }
  };

  const loadPermanent = async () => {
    try {
      const token = safeLocalStorage.getItem('token');
      if (!token) return;
      const res = await axios.get(`${API}/numbers/my-numbers`, { headers: { Authorization: `Bearer ${token}` } });
      setNumbers(res.data.numbers ?? []);
    } catch {
    } finally {
      setLoadingNums(false);
    }
  };

  useEffect(() => {
    loadOtp();
    loadPermanent();
    loadBridgePhoneValidity();
  }, []);

  useEffect(() => {
    if (view !== 'otp') return;
    pollRef.current = setInterval(async () => {
      const active = otpOrders.filter(o => o.status === 'active' && !o.sms_code);
      if (!active.length) return;
      try {
        const token = safeLocalStorage.getItem('token');
        await Promise.all(active.map(o =>
          axios.get(`${API}/verification/status/${o.order_code}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
        ));
        loadOtp();
      } catch {}
    }, 6000);
    return () => clearInterval(pollRef.current);
  }, [view, otpOrders]);

  const refundOrder = async (code) => {
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.delete(`${API}/verification/cancel/${code}`, { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'Success', description: 'Order refunded.' });
      loadOtp();
    } catch (e) {
      toast({ title: 'Refund failed', description: e.response?.data?.detail || 'Try again in a moment', variant: 'destructive' });
    }
  };

  const checkOrder = async (code) => {
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.get(`${API}/verification/status/${code}`, { headers: { Authorization: `Bearer ${token}` } });
      loadOtp();
    } catch {}
  };

  const handleCopyPermanent = (e, num) => {
    e.stopPropagation();
    navigator.clipboard.writeText(num).catch(() => {});
    setCopiedNum(num);
    setTimeout(() => setCopiedNum(null), 1800);
  };

  const loading = view === 'otp' ? loadingOtp : loadingNums;
  const data = view === 'otp' ? otpOrders : numbers;

  return (
    <div className="min-h-screen bg-[var(--bg-page)] pb-[100px]">
      
      <header className="bg-[var(--bg-page)] border-b border-[var(--border-1)] sticky top-0 z-30">
        <div className="max-w-lg mx-auto px-4 h-[67px] flex items-center gap-3">
          <button
            type="button"
            onClick={() => goBack()}
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--soft-fill)', border: '1px solid var(--soft-border)' }}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <h1 className="flex-1 text-[20px] font-extrabold text-[var(--text-1)]">My Numbers</h1>
          <button onClick={() => navigate('/browse-numbers')} className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-[0_4px_8px_rgba(168,85,247,0.4)] transition-transform active:scale-95">
            <Plus className="w-[18px] h-[18px] text-white" />
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto pt-3.5">
        
        <div className="flex mx-4 mb-4 p-1 bg-[var(--bg-card)] rounded-xl border border-[var(--border-1)]">
          <button 
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-[13px] font-bold transition-colors ${view === 'permanent' ? 'bg-primary text-white' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'}`} 
            onClick={() => setView('permanent')}
          >
            <Phone className="w-3.5 h-3.5" /> Numbers
          </button>
          <button 
            className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-[13px] font-bold transition-colors ${view === 'otp' ? 'bg-primary text-white' : 'text-[var(--text-2)] hover:text-[var(--text-1)]'}`} 
            onClick={() => setView('otp')}
          >
            <MessageSquare className="w-3.5 h-3.5" /> OTP Orders
          </button>
        </div>

        {bridgePhoneIsCalliotel && (
          <button onClick={() => navigate('/profile/settings')} className="w-[calc(100%-32px)] mx-4 mb-2.5 p-3.5 rounded-[14px] bg-red-500/10 border border-red-500/30 flex items-center justify-between text-left active:bg-red-500/20 transition-colors">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-[18px] h-[18px] text-red-500 flex-shrink-0" />
              <div>
                <p className="text-[14px] font-bold text-red-500">Forwarding number is a virtual number</p>
                <p className="text-[12px] text-red-500/70 mt-0.5">Set your real mobile number instead — virtual numbers can't receive calls.</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-red-500 flex-shrink-0 ml-2" />
          </button>
        )}

        {bridgePhoneInvalid && (
          <button onClick={() => navigate('/profile/settings')} className="w-[calc(100%-32px)] mx-4 mb-2.5 p-3.5 rounded-[14px] bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-left active:bg-amber-500/20 transition-colors">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-[18px] h-[18px] text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-[14px] font-bold text-amber-500">Forwarding number looks invalid</p>
                <p className="text-[12px] text-amber-500/70 mt-0.5">Your calls won't connect until you fix it. Tap to update.</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0 ml-2" />
          </button>
        )}

        {loading ? (
          <div className="flex justify-center mt-10">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-16 pb-10 px-8 text-center">
            {view === 'otp' ? (
              <MessageSquare className="w-12 h-12 text-[var(--text-3)] mb-2.5" />
            ) : (
              <PhoneOff className="w-12 h-12 text-[var(--text-3)] mb-2.5" />
            )}
            <p className="text-[18px] font-bold text-[var(--text-1)] mb-1">
              {view === 'otp' ? 'No OTP Orders Yet' : 'No Numbers Yet'}
            </p>
            <p className="text-[14px] text-[var(--text-2)] mb-4">
              {view === 'otp' ? 'Get a one-time number for WhatsApp, Telegram, Google & more' : 'Get a virtual number from 50+ countries'}
            </p>
            <button onClick={() => navigate(view === 'otp' ? '/one-otp' : '/browse-numbers')} className="px-6 py-3 rounded-xl bg-primary text-white text-[14px] font-bold transition-transform active:scale-95 shadow-[0_4px_8px_rgba(168,85,247,0.4)]">
              {view === 'otp' ? 'Get OTP Number' : 'Buy a Number'}
            </button>
          </div>
        ) : (
          <div className="px-4">
            {view === 'otp' ? (
              data.map(order => (
                <OtpOrderCard 
                  key={order.order_code} 
                  order={order} 
                  onRefund={refundOrder} 
                  onCheck={checkOrder} 
                  onBuyNew={() => navigate('/one-otp')} 
                />
              ))
            ) : (
              data.map(item => (
                <div 
                  key={item.phone_number}
                  onClick={() => navigate('/number-detail', { state: { number: item } })}
                  className="w-full flex items-center justify-between bg-[var(--bg-card)] rounded-2xl border border-[var(--border-1)] p-4 mb-2.5 text-left transition-colors hover:bg-[var(--bg-hover)] active:bg-[var(--bg-hover)] cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${item.status === 'active' ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                    <div>
                      <p className="text-[16px] font-bold text-[var(--text-1)] font-mono">{item.phone_number}</p>
                      <p className="text-[12px] text-[var(--text-2)] mt-0.5">{item.country || 'Unknown'} · ${(item.monthly_cost || 0).toFixed(2)}/mo</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    {copiedNum === item.phone_number ? (
                      <div className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[11px] font-semibold">Copied!</div>
                    ) : (
                      <button 
                        onClick={(e) => handleCopyPermanent(e, item.phone_number)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors ${item.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' : 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20'}`}
                      >
                        {item.status}
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-[var(--text-3)]" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default MyNumbersPage;
