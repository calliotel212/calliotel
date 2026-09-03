import React, { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import BottomNav from '../components/BottomNav';
import LandingNav from '../components/LandingNav';
import SEOHead from '../components/SEOHead';
import safeLocalStorage from '../utils/safeLocalStorage';
import useGoBack from '../hooks/useGoBack';
import { setAuthRedirect } from '../utils/authRedirect';
import { getServiceUseNote } from '../utils/serviceUseNotes';
import { getTelegramWebApp, haptic, isTelegramMiniApp } from '../utils/telegramMiniApp';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const authHeaders = () => {
  const token = safeLocalStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const fmtClock = (sec) => {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function AppLogo({ service, size = 28 }) {
  const [failed, setFailed] = useState(false);
  const logo = service?.logo;
  if (!logo || failed) {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{service?.icon || '📱'}</span>;
  }
  return (
    <img
      src={logo}
      alt=""
      width={size}
      height={size}
      className="rounded-md object-contain bg-white"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}

function ServiceNote({ code, name }) {
  const navigate = useNavigate();
  const text = getServiceUseNote(code, name);
  return (
    <div className="mt-3 p-3 rounded-xl border border-amber-500/45 bg-amber-500/10">
      <p className="text-[12px] font-extrabold text-amber-100">How to use VPN / proxy</p>
      <p className="text-[12px] text-amber-50/95 mt-1.5 leading-snug">{text}</p>
      <button
        type="button"
        onClick={() => navigate('/proxy')}
        className="mt-2 text-[12px] font-extrabold text-amber-200 underline"
      >
        Open Calliotel Proxy
      </button>
    </div>
  );
}

export default function OneOtpPage() {
  const { balance, refreshBalance, isAuthenticated, token, loading: authLoading } = useAuth();
  const signedIn = isAuthenticated || !!token;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inTg = isTelegramMiniApp();
  const goBack = useGoBack(inTg ? '/' : (signedIn ? '/account' : '/'));
  const lastHapticCode = useRef('');
  const lastHapticRefund = useRef('');
  const { toast } = useToast();

  const [catalog, setCatalog] = useState({
    services: [],
    countries: [],
    price: 1,
    configured: false,
    expire_minutes: 6,
  });
  const [service, setService] = useState('whatsapp');
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState('auto');
  const [cancelling, setCancelling] = useState(false);
  const [buying, setBuying] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [active, setActive] = useState(null);
  const [orders, setOrders] = useState([]);
  const [copied, setCopied] = useState('');
  const [now, setNow] = useState(Date.now());
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    if (!authHeaders().Authorization) {
      setOrders([]);
      return;
    }
    try {
      const res = await axios.get(`${API}/one-otp/my-orders`, { headers: authHeaders() });
      const rows = res.data.orders || [];
      setOrders(rows);
      setActive((prev) => {
        if (prev?.order_id) {
          const fresh = rows.find((o) => o.order_id === prev.order_id);
          if (fresh) return fresh;
        }
        const open = rows.find((o) => o.status === 'waiting' && !o.sms_code);
        return open || prev || null;
      });
    } catch {
      setOrders([]);
    }
  }, []);

  useEffect(() => {
    axios.get(`${API}/one-otp/catalog`).then((res) => {
      setCatalog(res.data);
      const listed = res.data.services || [];
      const wanted = (searchParams.get('service') || '').toLowerCase();
      if (wanted && listed.some((s) => s.code === wanted)) setService(wanted);
      else if (listed.some((s) => s.code === 'whatsapp')) setService('whatsapp');
      else if (listed[0]?.code) setService(listed[0].code);
      const wantedCountry = (searchParams.get('country') || '').toLowerCase();
      if (wantedCountry) setCountry(wantedCountry);
    }).catch(() => {});
    loadOrders();
  }, [loadOrders, searchParams]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!service) return undefined;
    let dead = false;
    setQuoteLoading(true);
    axios.get(`${API}/one-otp/availability`, { params: { service, country } }).then((res) => {
      if (!dead) setQuote(res.data);
    }).catch(() => {
      if (!dead) setQuote({ available: false });
    }).finally(() => {
      if (!dead) setQuoteLoading(false);
    });
    return () => { dead = true; };
  }, [service, country]);

  const selected = (catalog.services || []).find((s) => s.code === service);
  const price = Number(quote?.price || selected?.price || catalog.price || 0.99);
  const usaWhatsappBlocked = service === 'whatsapp' && country === 'usa';
  const soldOut = Boolean(quote) && quote.available === false && !usaWhatsappBlocked;
  const waitMins = catalog.expire_minutes || 6;

  useEffect(() => {
    if (searchParams.get('buy') !== '1') return undefined;
    if (authLoading || !signedIn || quoteLoading || usaWhatsappBlocked || soldOut || !service) return undefined;
    setConfirming(true);
    const params = new URLSearchParams(searchParams);
    params.delete('buy');
    const q = params.toString();
    navigate(q ? `/services?${q}` : '/services', { replace: true });
    return undefined;
  }, [searchParams, authLoading, signedIn, quoteLoading, usaWhatsappBlocked, soldOut, service, navigate]);

  useEffect(() => {
    if (!active?.order_id || active.status === 'got_sms' || active.status === 'cancelled') return undefined;
    const id = setInterval(async () => {
      try {
        const res = await axios.get(`${API}/one-otp/status/${active.order_id}`, { headers: authHeaders() });
        setActive(res.data);
        if (res.data.status === 'got_sms' || res.data.sms_code) {
          toast({ title: 'SMS received', description: res.data.sms_code || 'Code is ready' });
          loadOrders();
          if (refreshBalance) refreshBalance();
        }
        if (res.data.status === 'cancelled') {
          toast({
            title: 'Refunded — try another number',
            description: `No code in ${waitMins} minutes. $${Number(res.data.price_paid || price).toFixed(2)} is back in your wallet.`,
          });
          loadOrders();
          if (refreshBalance) refreshBalance();
        }
      } catch {}
    }, 4000);
    return () => clearInterval(id);
  }, [active, loadOrders, refreshBalance, toast, waitMins, price]);

  const goAuth = (mode) => {
    const params = new URLSearchParams();
    if (service) params.set('service', service);
    if (country && country !== 'auto') params.set('country', country);
    params.set('buy', '1');
    const next = `/services?${params.toString()}`;
    setAuthRedirect(next);
    navigate(`/${mode}?next=${encodeURIComponent(next)}`);
  };

  const buy = async () => {
    if (!signedIn) {
      goAuth('login');
      return;
    }
    setBuying(true);
    try {
      const res = await axios.post(
        `${API}/one-otp/buy`,
        { service, country },
        { headers: authHeaders() },
      );
      setActive(res.data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (refreshBalance) refreshBalance();
      loadOrders();
      toast({ title: 'Number ready', description: res.data.phone_number });
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = typeof detail === 'string' ? detail : 'Could not buy a number. Add credits or try Auto.';
      if (err.response?.status === 402) {
        toast({ title: 'Add credits', description: msg, variant: 'destructive' });
        navigate('/buy-credits');
      } else {
        toast({ title: 'OTP buy failed', description: msg, variant: 'destructive' });
      }
    } finally {
      setBuying(false);
    }
  };

  const cancel = async (orderId) => {
    if (!orderId || cancelling) return;
    setCancelling(true);
    try {
      await axios.post(`${API}/one-otp/cancel/${orderId}`, {}, { headers: authHeaders() });
      toast({ title: 'Refunded — try another number', description: 'Amount returned to your wallet.' });
      setActive((prev) => (prev && prev.order_id === orderId ? { ...prev, status: 'cancelled', refunded: true } : prev));
      loadOrders();
      if (refreshBalance) refreshBalance();
    } catch (err) {
      toast({
        title: 'Cannot refund yet',
        description: err.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    } finally {
      setCancelling(false);
    }
  };

  const copy = useCallback(async (value, key) => {
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => {});
    if (inTg) haptic('impact');
    setCopied(key);
    setTimeout(() => setCopied(''), 1500);
  }, [inTg]);

  const waiting = active && active.status === 'waiting' && !active.sms_code;
  const refunded = active && (active.status === 'cancelled' || active.refunded);

  useEffect(() => {
    const code = active?.sms_code || '';
    if (inTg && code && code !== lastHapticCode.current) haptic('success');
    lastHapticCode.current = code;
  }, [active?.sms_code, inTg]);

  useEffect(() => {
    const id = refunded && !active?.sms_code ? (active?.order_id || 'refund') : '';
    if (inTg && id && id !== lastHapticRefund.current) haptic('warning');
    lastHapticRefund.current = id;
  }, [refunded, active?.sms_code, active?.order_id, inTg]);

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!inTg || !tg?.MainButton || !tg?.BackButton) return undefined;
    const mb = tg.MainButton;
    const bb = tg.BackButton;
    const onBack = () => {
      if (active?.phone_number) setActive(null);
      else goBack();
    };
    const onMain = () => {
      if (active?.sms_code) copy(active.sms_code, 'code');
      else if (active?.phone_number) copy(active.phone_number, 'phone');
    };
    try {
      bb.onClick(onBack);
      bb.show();
      if (active?.sms_code) {
        mb.setText('Copy code');
        mb.show();
        mb.onClick(onMain);
      } else if (active?.phone_number && waiting) {
        mb.setText('Copy number');
        mb.show();
        mb.onClick(onMain);
      } else {
        mb.hide();
      }
    } catch {
      /* older clients */
    }
    return () => {
      try {
        mb.offClick(onMain);
        bb.offClick(onBack);
        mb.hide();
        bb.hide();
      } catch {
        /* ignore */
      }
    };
  }, [inTg, active, waiting, goBack, copy]);
  const expiresIn = active?.expires_at
    ? Math.max(0, Math.floor((new Date(active.expires_at).getTime() - now) / 1000))
    : null;
  const cancelWaitLeft = (order) => {
    if (!order?.created_at) return 0;
    const created = new Date(order.created_at).getTime();
    if (Number.isNaN(created)) return 0;
    return Math.max(0, Math.ceil((created + 120000 - now) / 1000));
  };
  const renderCancel = (order) => {
    if (!order || order.status !== 'waiting' || order.sms_code) return null;
    const left = cancelWaitLeft(order);
    const amount = Number(order.price_paid || price).toFixed(2);
    if (left > 0) {
      return (
        <button
          type="button"
          disabled
          className="mt-3 w-full py-3 rounded-xl border-2 border-white/20 text-[14px] font-extrabold text-white/50"
        >
          Cancel in {fmtClock(left)}
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={() => cancel(order.order_id)}
        disabled={cancelling}
        className="mt-3 w-full py-3 rounded-xl border-2 border-red-400 bg-red-500/15 text-red-200 text-[15px] font-extrabold disabled:opacity-50"
      >
        {cancelling ? 'Refunding…' : `Cancel and refund $${amount}`}
      </button>
    );
  };
  const q = query.trim().toLowerCase();
  const allServices = catalog.services || [];
  const filtered = q
    ? allServices.filter((s) => `${s.name} ${s.code}`.toLowerCase().includes(q))
    : allServices;
  const serviceCount = catalog.service_count || allServices.length;
  const countryName = (catalog.countries || []).find((c) => c.code === country)?.name || 'Auto';

  return (
    <div className={`min-h-screen bg-[var(--bg-page)] ${signedIn ? 'pb-[160px]' : 'pb-16'}`}>
      <SEOHead
        title="180+ services from $0.99"
        description="Search 180+ services on Calliotel before you sign up. WhatsApp, Instagram, Telegram and more. Buy after you create an account."
        keywords="virtual number, calliotel, whatsapp, instagram, telegram, 180 services"
        path="/services"
      />
      {signedIn ? (
      <header className="sticky top-0 z-30 bg-[var(--bg-page)] border-b border-[var(--border-1)]">
        <div className="max-w-lg mx-auto px-4 h-[60px] flex items-center gap-3">
          {!inTg && (
          <button
            type="button"
            onClick={goBack}
            className="w-9 h-9 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          )}
          <div className="flex-1">
            <h1 className="text-[18px] font-extrabold text-[var(--text-1)]">180+ Services</h1>
            <p className="text-[12px] text-[var(--text-2)]">
              {serviceCount ? `${serviceCount} apps` : '180+ services'} · from $0.99
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-2)]">Wallet</p>
            <p className="text-[16px] font-extrabold text-[var(--text-1)]">
              ${Number(balance || 0).toFixed(2)}
            </p>
          </div>
        </div>
      </header>
      ) : (
        <LandingNav />
      )}

      <div className="max-w-lg mx-auto px-4 pt-4">
        {!signedIn && (
          <div className="mb-4">
            <h1 className="text-[22px] font-extrabold text-[var(--text-1)]">180+ services</h1>
            <p className="text-[13px] text-[var(--text-2)] mt-1">
              Search any app. Sign up or log in when you are ready to buy.
            </p>
          </div>
        )}
        <div className="mb-4 p-3.5 rounded-2xl border border-amber-500/40 bg-amber-500/10">
          <p className="text-[14px] font-extrabold text-[var(--text-1)]">
            {signedIn ? 'No code in 6 minutes?' : 'Didn’t arrive in 6 minutes?'}
          </p>
          <p className="text-[13px] text-[var(--text-2)] mt-1 leading-snug">
            We refund the ${price.toFixed(2)} automatically. Then try another number.
          </p>
        </div>

        {active?.phone_number && (
          <div className="mb-4 p-4 rounded-2xl border border-[var(--border-1)] bg-[var(--bg-card)]">
            <p className="text-[12px] font-bold uppercase text-[var(--text-2)] mb-1">
              {active.service_name} · {active.country}
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[22px] font-extrabold font-mono text-[var(--text-1)]">{active.phone_number}</p>
              <button
                type="button"
                onClick={() => copy(active.phone_number, 'phone')}
                className="px-3 py-1.5 rounded-lg bg-primary text-white text-[12px] font-bold"
              >
                {copied === 'phone' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {active.sms_code ? (
              <button
                type="button"
                onClick={() => copy(active.sms_code, 'code')}
                className="mt-3 w-full py-3 rounded-xl bg-emerald-600 text-white font-extrabold text-[20px] tracking-widest"
              >
                {copied === 'code' ? 'Copied' : active.sms_code}
              </button>
            ) : waiting ? (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-[var(--text-2)]">
                  <Loader className="w-4 h-4 animate-spin" />
                  Waiting for SMS
                </div>
                {expiresIn != null && (
                  <p className="mt-1 text-[20px] font-extrabold font-mono text-[var(--text-1)]">
                    {fmtClock(expiresIn)}
                  </p>
                )}
                <p className="text-[12px] text-[var(--text-2)] mt-1">
                  If the code does not arrive in {waitMins} minutes, ${Number(active.price_paid || price).toFixed(2)} is refunded automatically.
                </p>
                {renderCancel(active)}
                <p className="text-[11px] text-[var(--text-2)] mt-2">
                  Cancel opens after 2 minutes. After 6 minutes we refund automatically.
                </p>
                <ServiceNote code={active.service} name={active.service_name} />
              </div>
            ) : null}
            {refunded && !active.sms_code && (
              <button
                type="button"
                onClick={() => setActive(null)}
                className="mt-3 w-full py-3 rounded-xl bg-primary text-white text-[14px] font-extrabold"
              >
                Try another number
              </button>
            )}
          </div>
        )}

        <div className="mb-4 p-4 rounded-2xl border border-primary/40 bg-[var(--bg-card)]">
          <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--text-2)]">Selected app</p>
          <div className="flex items-center gap-3 mt-2">
            <AppLogo service={selected} size={36} />
            <p className="text-[18px] font-extrabold text-[var(--text-1)]">
              {selected?.name || 'Pick an app below'}
            </p>
          </div>
          <p className="text-[13px] text-[var(--text-2)] mt-1">Country is Auto (cheapest). Change it if you want.</p>
          <ServiceNote code={selected?.code || service} name={selected?.name} />
          <div className="flex flex-wrap gap-2 mt-3 mb-3">
            {(catalog.countries || []).map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => setCountry(c.code)}
                className={`px-3 py-2 rounded-full text-[12px] font-bold border ${
                  country === c.code
                    ? 'border-primary bg-primary text-white'
                    : 'border-[var(--border-1)] bg-[var(--bg-page)] text-[var(--text-1)]'
                }`}
              >
                {c.flag} {c.name}
              </button>
            ))}
          </div>
          {usaWhatsappBlocked && (
            <p className="text-[13px] text-amber-200 mb-3">
              USA WhatsApp is not offered. Keep Auto country.
            </p>
          )}
          {soldOut && (
            <p className="text-[13px] text-amber-200 mb-3">
              No number at our price for that country. Try Auto.
            </p>
          )}
          <button
            type="button"
            onClick={() => (signedIn ? setConfirming(true) : goAuth('signup'))}
            disabled={buying || usaWhatsappBlocked || soldOut || !service || quoteLoading}
            className="w-full py-3.5 rounded-xl bg-primary text-white text-[15px] font-extrabold disabled:opacity-50"
          >
            {quoteLoading
              ? 'Checking live price…'
              : signedIn
                ? `Get ${selected?.name || 'number'} · $${price.toFixed(2)}`
                : `Sign up to get ${selected?.name || 'this'} · $${price.toFixed(2)}`}
          </button>
          {!signedIn && (
            <button
              type="button"
              onClick={() => goAuth('login')}
              className="w-full mt-2 py-2.5 rounded-xl border border-[var(--border-1)] text-[13px] font-bold text-[var(--text-2)]"
            >
              Already have an account? Log in
            </button>
          )}
          <p className="text-[12px] text-[var(--text-2)] mt-2">
            Charged only after a number is assigned.
          </p>
        </div>

        <p className="text-[13px] font-bold text-[var(--text-1)] mb-2">
          Service · {filtered.length} apps
        </p>
        <div className="relative mb-3">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-2)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search WhatsApp, PayPal, Discord…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[var(--border-1)] bg-[var(--bg-card)] text-[14px] text-[var(--text-1)] outline-none"
          />
        </div>
        <div className="mb-4 max-h-[480px] overflow-y-auto pr-1">
          <div className="grid grid-cols-3 gap-2">
            {filtered.map((s) => (
              <button
                key={s.code}
                type="button"
                onClick={() => setService(s.code)}
                className={`p-3 rounded-xl border text-left ${
                  service === s.code
                    ? 'border-primary bg-primary/15'
                    : 'border-[var(--border-1)] bg-[var(--bg-card)]'
                }`}
              >
                <div className="mb-1">
                  <AppLogo service={s} size={28} />
                </div>
                <div className="text-[12px] font-bold text-[var(--text-1)] leading-tight">{s.name}</div>
                <div className="text-[11px] font-extrabold text-primary mt-1">
                  ${Number(s.price || catalog.price || 0.99).toFixed(2)}
                </div>
              </button>
            ))}
          </div>
          {filtered.length === 0 && (
            <p className="p-4 text-[13px] text-[var(--text-2)]">No app matches that search.</p>
          )}
        </div>

        {orders.length > 0 && (
          <div>
            <p className="text-[15px] font-extrabold text-white mb-2">Recent</p>
            {orders.map((o) => {
              const gotCode = Boolean(o.sms_code);
              const isWaiting = o.status === 'waiting' && !gotCode;
              const isRefunded = o.refunded || o.status === 'cancelled';
              const statusLabel = gotCode ? 'Code ready' : isWaiting ? 'Waiting' : isRefunded ? 'Refunded' : o.status;
              const statusColor = gotCode ? '#34d399' : isWaiting ? '#F5A623' : '#94a3b8';
              return (
                <div
                  key={o.order_id}
                  className="w-full mb-2 p-3.5 rounded-2xl text-left"
                  style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.16)' }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActive(o);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono font-extrabold text-white text-[16px] tracking-wide">
                        {o.phone_number}
                      </span>
                      <span
                        className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-extrabold"
                        style={{ color: statusColor, background: `${statusColor}22`, border: `1px solid ${statusColor}55` }}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <p className="text-[13px] text-white/75 mt-1.5">
                      {o.service_name}
                      {gotCode ? ` · ${o.sms_code}` : isRefunded ? ' · money back in wallet' : ' · waiting for code'}
                    </p>
                  </button>
                  {isWaiting && renderCancel(o)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] border border-[var(--border-1)] p-5">
            <p className="text-[13px] font-bold uppercase tracking-wide text-[var(--text-2)]">Confirm purchase</p>
            <div className="flex items-center gap-3 mt-3">
              <AppLogo service={selected} size={40} />
              <p className="text-[20px] font-extrabold text-[var(--text-1)]">
                {selected?.name || 'This app'}
              </p>
            </div>
            <p className="text-[14px] text-[var(--text-2)] mt-2">
              {countryName} · ${price.toFixed(2)} from your wallet
            </p>
            <p className="text-[13px] text-[var(--text-2)] mt-3 leading-snug">
              If no code in 6 minutes, we refund this amount and you try another number.
            </p>
            <p className="text-[12px] text-[var(--text-2)] mt-2 leading-snug">
              {getServiceUseNote(selected?.code || service, selected?.name)}
            </p>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={buying}
                className="flex-1 py-3 rounded-xl bg-white text-black text-[14px] font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await buy();
                  setConfirming(false);
                }}
                disabled={buying}
                className="flex-1 py-3 rounded-xl bg-primary text-white text-[14px] font-extrabold disabled:opacity-50"
              >
                {buying ? 'Buying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {signedIn && !(inTg && active?.phone_number) && <BottomNav />}
    </div>
  );
}
