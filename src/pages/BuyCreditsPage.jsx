import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader, Copy, Check, Clock, CreditCard, Globe, ChevronRight, Banknote } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';
import useGoBack from '../hooks/useGoBack';
import { peekPendingNumberPurchase, clearPendingNumberPurchase } from '../utils/authRedirect';
import { trackWalletTopup } from '../utils/gtagConversions';
import {
  CARD_MAX,
  CARD_MIN,
  CARD_PACKAGES,
  CARD_ACCOUNT_AGE_HOURS,
  CRYPTO_FLOOR,
  USDT_FLOOR,
  isLocalPayPreview,
  PREVIEW_COUNTRIES,
  accountTooNewForCard,
  preferredPayMethod,
  payReason,
  countryLabel,
  cryptoPayAmount,
  suggestedCardAmount,
} from '../utils/payWorldwide';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const BRAND = '#F5A623';

const PACKAGES = [
  { id: 'two', price: 2, badge: 'Start' },
  { id: 'three', price: 3, badge: null },
  { id: 'five', price: 5, badge: '60 min' },
  { id: 'six', price: 6, badge: null },
  { id: 'seven', price: 7, badge: null },
  { id: 'eight', price: 8, badge: null },
  { id: 'ten', price: 10, badge: null },
  { id: 'twelve', price: 12, badge: 'Crypto' },
  { id: 'twenty', price: 20, badge: 'Card max' },
  { id: 'fifty', price: 50, badge: null },
];
const CARD_PACKAGE_SET = new Set(CARD_PACKAGES);
const CRYPTO_PACKAGE_SET = new Set([12, 20, 50]);

const CRYPTO_COINS = [
  { id: 'USDT_TRC20', nowp: 'usdttrc20', label: 'USDT TRC-20', icon: '₮', color: '#26a17b', sub: 'From $12', featured: true },
  { id: 'TRX', nowp: 'trx', label: 'TRON', icon: 'T', color: '#ef4444', sub: 'From $12' },
  { id: 'LTC', nowp: 'ltc', label: 'Litecoin', icon: 'Ł', color: '#345d9d', sub: 'From $12' },
  { id: 'XRP', nowp: 'xrp', label: 'XRP', icon: '✕', color: '#346aa9', sub: 'From $12' },
  { id: 'BCH', nowp: 'bch', label: 'Bitcoin Cash', icon: 'B', color: '#8dc351', sub: 'From $12' },
  { id: 'SOL', nowp: 'sol', label: 'Solana', icon: '◎', color: '#9945ff', sub: 'From $12' },
  { id: 'TON', nowp: 'ton', label: 'TON', icon: '◆', color: '#0098ea', sub: 'From $12' },
  { id: 'DOGE', nowp: 'doge', label: 'Dogecoin', icon: 'Ð', color: '#c2a633', sub: 'From $12' },
  { id: 'BTC', nowp: 'btc', label: 'Bitcoin', icon: '₿', color: '#f7931a', sub: 'From $12 · fee high' },
];

function suggestedTopUp(needed) {
  const price = suggestedCardAmount(needed);
  return PACKAGES.find((a) => a.price === price) || { id: String(price), price, badge: null };
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
        background: copied ? 'rgba(245,166,35,0.2)' : 'rgba(255,255,255,0.08)',
        border: copied ? '1px solid rgba(245,166,35,0.4)' : '1px solid rgba(255,255,255,0.12)',
        color: copied ? BRAND : 'rgba(255,255,255,0.7)',
        cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0,
      }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

const NOWPAYMENTS_DONE = new Set(['finished', 'confirmed', 'sending']);

function CryptoModal({ order, onClose, onSuccess, coinLabel }) {
  const [status, setStatus] = useState('waiting');
  const [timeLeft, setTimeLeft] = useState(60 * 60);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);

    pollRef.current = setInterval(async () => {
      try {
        const token = safeLocalStorage.getItem('token');
        const res = await axios.get(
          `${API}/payments/nowpayments/status/${order.payment_id}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const s = res.data.status;
        setStatus(s);
        if (NOWPAYMENTS_DONE.has(s)) {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setTimeout(() => onSuccess(res.data.credits_to_add), 1500);
        }
      } catch { /* keep polling */ }
    }, 15000);

    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, [order.payment_id, onSuccess]);

  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const isDone = NOWPAYMENTS_DONE.has(status);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 24, width: '100%', maxWidth: 480, padding: 28, border: '1px solid rgba(245,166,35,0.25)' }}>
        {isDone ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ color: BRAND, fontWeight: 800, fontSize: 18 }}>Payment confirmed</p>
            <p style={{ color: 'var(--text-2)', fontSize: 13, marginTop: 6 }}>Credits are being added to your account</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <p style={{ color: 'var(--text-1)', fontWeight: 700, fontSize: 16 }}>Pay with {coinLabel || 'Crypto'}</p>
                <p style={{ color: 'var(--text-2)', fontSize: 12, marginTop: 2 }}>Send to the address below · Works worldwide</p>
              </div>
              <button onClick={onClose} style={{ color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, padding: 4 }}>✕</button>
            </div>

            <div style={{ background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <p style={{ color: 'rgba(245,166,35,0.95)', fontSize: 12, fontWeight: 600, margin: 0 }}>
                Send exactly the amount below. Credits add automatically after blockchain confirm (usually 1–3 min).
              </p>
            </div>

            <div style={{ background: 'var(--soft-fill-2)', borderRadius: 14, padding: '16px 18px', marginBottom: 14 }}>
              <p style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 6 }}>Amount to send ({coinLabel || 'Crypto'})</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ color: BRAND, fontWeight: 700, fontSize: 22, fontFamily: 'monospace', margin: 0 }}>
                  {order.pay_amount} {(coinLabel || '').split(' ')[0].toUpperCase() || 'CRYPTO'}
                </p>
                <CopyButton text={String(order.pay_amount)} />
              </div>
              <p style={{ color: BRAND, fontSize: 11, marginTop: 6, fontWeight: 600 }}>
                Send the exact amount shown — no more, no less
              </p>
            </div>

            <div style={{ background: 'var(--soft-fill-2)', borderRadius: 14, padding: '16px 18px', marginBottom: 18 }}>
              <p style={{ color: 'var(--text-2)', fontSize: 11, marginBottom: 6 }}>Wallet address — send {coinLabel || 'Crypto'} only</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <p style={{ color: 'var(--text-1)', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', flex: 1, margin: 0 }}>{order.pay_address}</p>
                <CopyButton text={order.pay_address} />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: BRAND, animation: 'npPulse 2s infinite' }} />
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                  {status === 'confirming' ? 'Confirming on blockchain…' : 'Waiting for your payment…'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: timeLeft < 300 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
                <Clock size={13} />
                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600 }}>{mins}:{secs}</span>
              </div>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes npPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.4)} }`}</style>
    </div>
  );
}

const BuyCreditsPage = () => {
  const pendingPurchase = peekPendingNumberPurchase();
  const numberPrice = Number(pendingPurchase?.price || pendingPurchase?.amount || 0);
  const buyMode = Boolean(pendingPurchase?.area_code || pendingPurchase?.label);
  const defaultTopUp = suggestedTopUp(numberPrice || 5);

  const [step, setStep] = useState('amount'); // 'amount' | 'pay' | 'crypto'
  const [amount, setAmount] = useState(buyMode ? defaultTopUp.price : 5);
  const [customRaw, setCustomRaw] = useState('');
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const [cardLocked, setCardLocked] = useState(false);
  const [selectedCoinId, setSelectedCoinId] = useState('USDT_TRC20');
  const [cryptoOrder, setCryptoOrder] = useState(null);
  const [userCountry, setUserCountry] = useState(null);
  const [coinMins, setCoinMins] = useState({});
  const [fincraEnabled, setFincraEnabled] = useState(false);
  const [fincraRate, setFincraRate] = useState(null);
  const [fincraLoading, setFincraLoading] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const goBack = useGoBack('/account');
  const { user, balance, refreshBalance } = useAuth();
  const canActivateFromWallet = buyMode && numberPrice > 0 && balance != null && Number(balance) >= numberPrice;

  const cardTooNew = accountTooNewForCard(user?.created_at);
  const payMethod = preferredPayMethod({ country: userCountry, createdAt: user?.created_at, amount, fincraEnabled });
  const fincraPrimary = payMethod === 'fincra';
  const cryptoPrimary = payMethod === 'crypto';
  const reason = payReason({ country: userCountry, createdAt: user?.created_at, amount, fincraEnabled });
  const cardAllowed = amount > 0 && amount <= CARD_MAX && !cardTooNew && !cardLocked;
  const coinMin = (id) => {
    const coin = CRYPTO_COINS.find((c) => c.id === id);
    const live = Number(coinMins[coin?.nowp || '']);
    if (live > 0) return live;
    return CRYPTO_FLOOR;
  };
  const cryptoMin = coinMin(selectedCoinId);
  const cryptoAllowed = amount >= cryptoMin;
  const usdtMin = coinMin('USDT_TRC20');
  const usdtAllowed = amount >= usdtMin;
  const selectedPackage = PACKAGES.find((p) => p.price === amount) || null;
  const numberLabel = pendingPurchase?.label || (pendingPurchase?.area_code ? `+${pendingPurchase.area_code}` : null);
  const firstHourPay = buyMode || (
    typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('resume') === '1'
  );

  const goAfterPayment = (paid) => {
    const raw = safeLocalStorage.getItem('pendingNumberPurchase');
    if (raw) {
      let pending;
      try { pending = JSON.parse(raw); } catch { pending = null; }
      if (pending?.area_code) {
        toast({ title: 'Payment received', description: `Activating ${pending.label || pending.area_code} now…` });
        navigate('/first-hour');
        return;
      }
    }
    toast({ title: `$${paid} ready`, description: 'Choose your number to finish.' });
    navigate(`/browse-numbers?funded=1&amount=${encodeURIComponent(paid)}`);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get('stripe_success') === '1') {
      const paid = params.get('amount') || '?';
      const paidNum = parseFloat(paid);
      window.history.replaceState({}, '', '/buy-credits');
      refreshBalance();
      if (!Number.isNaN(paidNum) && paidNum > 0) {
        trackWalletTopup({
          value: paidNum,
          currency: 'USD',
          method: 'stripe',
          transactionId: `stripe_${paidNum}`,
        });
      }
      toast({
        title: 'Card payment received',
        description: `$${paid} added to your wallet.`,
      });
      setTimeout(() => goAfterPayment(paid), 1500);
    }

    if (params.get('fincra_success') === '1') {
      const paid = params.get('amount') || '?';
      const paidNum = parseFloat(paid);
      const orderId = params.get('order') || '';
      window.history.replaceState({}, '', '/buy-credits');
      const token = safeLocalStorage.getItem('token');
      const finish = () => {
        try { sessionStorage.removeItem('fincra_pending'); } catch { /* ignore */ }
        refreshBalance();
        if (!Number.isNaN(paidNum) && paidNum > 0) {
          trackWalletTopup({
            value: paidNum,
            currency: 'USD',
            method: 'fincra',
            transactionId: `fincra_${orderId || paidNum}`,
          });
        }
        toast({
          title: 'Naira payment received',
          description: `$${paid} added to your wallet.`,
        });
        setTimeout(() => goAfterPayment(paid), 1500);
      };
      if (token && orderId) {
        axios.get(`${API}/payments/fincra/confirm/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then(finish).catch(() => {
          toast({
            title: 'Confirming Naira payment',
            description: 'If the wallet is empty in a minute, refresh — the webhook may still be catching up.',
          });
          refreshBalance();
        });
      } else {
        finish();
      }
    } else {
      // Local sandbox: no redirect from Fincra — confirm pending order when user returns.
      try {
        const raw = sessionStorage.getItem('fincra_pending');
        if (raw) {
          const pending = JSON.parse(raw);
          const token = safeLocalStorage.getItem('token');
          if (token && pending?.orderId && Date.now() - (pending.at || 0) < 60 * 60 * 1000) {
            axios.get(`${API}/payments/fincra/confirm/${pending.orderId}`, {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => {
              if (r.data?.status === 'completed' || r.data?.credited) {
                sessionStorage.removeItem('fincra_pending');
                const paid = pending.amount || amount;
                refreshBalance();
                trackWalletTopup({
                  value: Number(paid) || 0,
                  currency: 'USD',
                  method: 'fincra',
                  transactionId: `fincra_${pending.orderId}`,
                });
                toast({
                  title: 'Naira payment received',
                  description: `$${paid} added to your wallet.`,
                });
                setTimeout(() => goAfterPayment(paid), 1500);
              }
            }).catch(() => {});
          }
        }
      } catch { /* ignore */ }
    }

    const amtParam = parseFloat(params.get('amount') || '');
    if (!Number.isNaN(amtParam) && amtParam > 0) {
      setAmount(amtParam);
      if (!PACKAGES.some((p) => p.price === amtParam)) setCustomRaw(String(amtParam));
    } else if (params.get('resume') === '1' || buyMode) {
      setAmount(defaultTopUp.price);
    }

    const skipAmount = params.get('tab') === 'crypto'
      || params.get('resume') === '1'
      || params.get('pay') === '1'
      || buyMode;
    if (skipAmount) setStep('pay');

    const demo = (params.get('demoCountry') || '').toUpperCase();
    const preview = isLocalPayPreview()
      ? (demo || sessionStorage.getItem('pay_preview_country') || '')
      : '';
    if (preview) {
      setUserCountry(preview);
      return;
    }

    const cached = safeLocalStorage.getItem('user_country');
    if (cached) {
      setUserCountry(cached);
      return;
    }
    fetch('https://ipapi.co/json/')
      .then((r) => r.json())
      .then((d) => {
        const cc = d.country_code || '';
        setUserCountry(cc);
        safeLocalStorage.setItem('user_country', cc);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    axios.get(`${API}/payments/fincra/config`)
      .then((r) => {
        setFincraEnabled(Boolean(r.data?.enabled));
        if (r.data?.ngn_per_usd) setFincraRate(Number(r.data.ngn_per_usd));
      })
      .catch(() => setFincraEnabled(false));
  }, []);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    if (!token) return;
    axios.get(`${API}/payments/stripe/card-status`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => {
      if (r.data?.blocked) setCardLocked(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    if (!token) return;
    axios.get(`${API}/payments/nowpayments/mins`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => {
        const mins = r.data?.mins || {};
        setCoinMins(mins);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!cryptoPrimary) return;
    const floor = cryptoPayAmount(numberPrice || amount, usdtMin);
    if (amount < floor) {
      setAmount(floor);
      if (!PACKAGES.some((p) => p.price === floor)) setCustomRaw(String(floor));
    }
  }, [cryptoPrimary, usdtMin, numberPrice]);

  const handleCardBuy = async () => {
    if (!cardAllowed) return;
    setCardLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(`${API}/payments/stripe/create-checkout`, {
        amount,
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.data?.session_url) throw new Error('No checkout URL returned');
      window.location.href = res.data.session_url;
    } catch (err) {
      const detail = err.response?.data?.detail || '';
      const locked = err.response?.status === 403 && /locked|another card|support/i.test(String(detail));
      if (locked) {
        setCardLocked(true);
        toast({
          title: 'Card payments locked',
          description: 'After 3 declines you cannot try another card. Open Support — a ticket was created.',
          variant: 'destructive',
        });
        navigate('/support');
        return;
      }
      toast({
        title: 'Card did not start',
        description: detail || `Card often fails here. Pay $${usdtMin} with USDT — same wallet.`,
        variant: 'destructive',
      });
    } finally {
      setCardLoading(false);
    }
  };

  const nairaLabel = () => {
    if (fincraRate && amount) {
      const n = Math.round(amount * fincraRate * 1.03);
      return `Pay ₦${n.toLocaleString()} ($${amount})`;
    }
    return `Pay $${amount} with Naira`;
  };

  const handleFincraBuy = async () => {
    if (!fincraEnabled || amount < CARD_MIN || amount > CARD_MAX) return;
    setFincraLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(`${API}/payments/fincra/create-checkout`, {
        amount,
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.data?.checkout_url) throw new Error('No checkout URL returned');
      const orderId = res.data.order_id;
      const paidAmt = res.data.amount_usd || amount;
      try {
        sessionStorage.setItem('fincra_pending', JSON.stringify({
          orderId,
          amount: paidAmt,
          at: Date.now(),
        }));
      } catch { /* ignore */ }

      const isLocal = typeof window !== 'undefined'
        && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

      if (isLocal) {
        // Fincra cannot redirect to localhost → leave this tab open and poll.
        const win = window.open(res.data.checkout_url, '_blank');
        if (!win) {
          toast({
            title: 'Allow pop-ups',
            description: 'Or we will open Fincra in this tab — come back to buy-credits after you pay.',
          });
          window.location.href = res.data.checkout_url;
          return;
        }
        toast({
          title: 'Pay in the Fincra tab',
          description: 'When it says success, close that tab. This page will credit your wallet.',
        });
        let tries = 0;
        const poll = setInterval(async () => {
          tries += 1;
          if (tries > 60) { clearInterval(poll); return; }
          try {
            const r = await axios.get(`${API}/payments/fincra/confirm/${orderId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (r.data?.status === 'completed' || r.data?.credited) {
              clearInterval(poll);
              try { sessionStorage.removeItem('fincra_pending'); } catch { /* ignore */ }
              refreshBalance();
              trackWalletTopup({
                value: Number(paidAmt) || 0,
                currency: 'USD',
                method: 'fincra',
                transactionId: `fincra_${orderId}`,
              });
              toast({
                title: 'Naira payment received',
                description: `$${paidAmt} added to your wallet.`,
              });
              setTimeout(() => goAfterPayment(paidAmt), 1000);
            }
          } catch { /* keep polling */ }
        }, 3000);
      } else {
        window.location.href = res.data.checkout_url;
      }
    } catch (err) {
      toast({
        title: 'Naira checkout did not start',
        description: err.response?.data?.detail || 'Try again, or pay with USDT.',
        variant: 'destructive',
      });
    } finally {
      setFincraLoading(false);
    }
  };

  const confirmFincraPending = async () => {
    const token = safeLocalStorage.getItem('token');
    if (!token) return;
    let pending;
    try { pending = JSON.parse(sessionStorage.getItem('fincra_pending') || 'null'); } catch { pending = null; }
    try {
      let r;
      if (pending?.orderId) {
        r = await axios.get(`${API}/payments/fincra/confirm/${pending.orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        r = await axios.post(`${API}/payments/fincra/confirm-latest`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      if (r.data?.status === 'completed' || r.data?.credited) {
        try { sessionStorage.removeItem('fincra_pending'); } catch { /* ignore */ }
        const paid = r.data?.amount_usd || pending?.amount || amount;
        refreshBalance();
        toast({ title: 'Naira payment received', description: `$${paid} added to your wallet.` });
        setTimeout(() => goAfterPayment(paid), 1000);
      } else {
        toast({
          title: 'Not credited yet',
          description: 'Finish the Fincra payment, wait a few seconds, then tap again.',
        });
      }
    } catch (err) {
      toast({
        title: 'Confirm failed',
        description: err.response?.data?.detail || 'Try again in a moment.',
        variant: 'destructive',
      });
    }
  };

  const handleCryptoBuy = async (coinId) => {
    const coin = typeof coinId === 'string' ? coinId : selectedCoinId;
    const min = coinMin(coin);
    if (amount < min) return;
    if (coin !== selectedCoinId) setSelectedCoinId(coin);
    setCryptoLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const nowp = CRYPTO_COINS.find((c) => c.id === coin)?.nowp || 'usdttrc20';
      const res = await axios.post(`${API}/payments/nowpayments/create`, {
        amount,
        currency: nowp,
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.data?.pay_address || !res.data?.payment_id) throw new Error('No payment address');
      const resumedCoin = CRYPTO_COINS.find((c) => c.nowp === res.data.pay_currency);
      if (resumedCoin) setSelectedCoinId(resumedCoin.id);
      setCryptoOrder(res.data);
    } catch (err) {
      toast({
        title: 'Crypto Error',
        description: err.response?.data?.detail || 'Could not create crypto order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setCryptoLoading(false);
    }
  };

  const setPreviewCountry = (code) => {
    setUserCountry(code);
    try { sessionStorage.setItem('pay_preview_country', code); } catch { /* ignore */ }
  };

  const handleCryptoSuccess = async (credits) => {
    const paid = Number(credits) || 0;
    if (paid > 0) {
      trackWalletTopup({
        value: paid,
        currency: 'USD',
        method: 'nowpayments',
        transactionId: `nowp_${paid}_${Date.now()}`,
      });
    }
    await refreshBalance();
    setCryptoOrder(null);
    goAfterPayment(credits);
  };

  const pickPackage = (price) => {
    setAmount(price);
    setCustomRaw('');
  };

  const onCustomChange = (val) => {
    setCustomRaw(val);
    const n = parseFloat(val);
    if (!Number.isNaN(n) && n > 0) setAmount(Math.round(n * 100) / 100);
  };

  const continueToPay = () => {
    if (!amount || amount < CARD_MIN) {
      toast({ title: 'Enter an amount', description: `Card from $${CARD_MIN}. USDT from $${USDT_FLOOR}.`, variant: 'destructive' });
      return;
    }
    setStep('pay');
  };

  const headerBack = () => {
    if (step === 'crypto') { setStep('pay'); return; }
    if (step === 'pay') { setStep('amount'); return; }
    goBack();
  };

  const skipResume = () => {
    clearPendingNumberPurchase();
    navigate('/account', { replace: true });
  };

  const activateFromWallet = () => {
    navigate('/browse-numbers?autopurchase=1');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-1)', paddingBottom: 100 }}>
      <style>{`
        .amt-tile:active { transform: scale(0.97); }
        .pay-btn:not(:disabled):hover { filter: brightness(1.08); }
        .pay-btn:not(:disabled):active { transform: scale(0.98); }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <header style={{ background: 'rgba(8,8,16,0.97)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--soft-border-2)', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={headerBack}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--soft-fill)', border: '1px solid var(--soft-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <ArrowLeft size={18} color="var(--text-1)" />
          </button>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)', lineHeight: 1.2, margin: 0 }}>
              {buyMode && numberLabel ? `Buy ${numberLabel}` : 'Buy Credits'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-2)', margin: 0 }}>
              {step === 'amount' && (buyMode ? 'Choose amount · activate instantly' : 'Choose amount')}
              {step === 'pay' && (firstHourPay ? 'One payment · number goes live' : 'Pay into the same wallet')}
              {step === 'crypto' && 'Send crypto · same wallet'}
            </p>
          </div>
          {balance !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)', borderRadius: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND }} />
              <span style={{ color: BRAND, fontWeight: 800, fontSize: 13 }}>${Number(balance).toFixed(2)}</span>
            </div>
          )}
        </div>
      </header>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {isLocalPayPreview() && (
          <div style={{
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,255,255,0.18)',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.6 }}>
              LOCALHOST · preview as country
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PREVIEW_COUNTRIES.map((c) => {
                const on = userCountry === c.code;
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setPreviewCountry(c.code)}
                    style={{
                      padding: '6px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      border: on ? `1px solid ${BRAND}` : '1px solid rgba(255,255,255,0.12)',
                      background: on ? 'rgba(245,166,35,0.18)' : 'transparent',
                      color: on ? BRAND : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {buyMode && numberLabel && step === 'amount' && (
          <div style={{
            padding: 16, borderRadius: 16,
            background: 'rgba(245,166,35,0.12)',
            border: '1.5px solid rgba(245,166,35,0.45)',
          }}>
            <p style={{ margin: 0, fontWeight: 900, fontSize: 16, color: BRAND }}>Buy this number</p>
            <p style={{ margin: '8px 0 0', fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>
              {numberLabel}
              {numberPrice > 0 ? <span style={{ marginLeft: 10, color: BRAND }}>${numberPrice.toFixed(2)}</span> : null}
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.45 }}>
              Top up below — we activate it automatically after payment.
            </p>
          </div>
        )}

        {step === 'amount' && (
          <div style={{
            borderRadius: 20, background: 'var(--bg-card)',
            border: '1px solid rgba(245,166,35,0.22)',
            padding: '22px 18px',
            display: 'flex', flexDirection: 'column', gap: 18,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 900, fontSize: 18, color: 'var(--text-1)' }}>Calliotel Credits</p>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>Add credits to your account</p>
            </div>

            <div style={{
              padding: '12px 14px', borderRadius: 14,
              background: 'rgba(59,130,246,0.12)',
              border: '1px solid rgba(59,130,246,0.35)',
            }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#93c5fd' }}>Late Summer Talk · ends Sep 21st</p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.45 }}>
                First $5 unlocks 60 minutes to the US &amp; Canada. Then $0.02/min. Real calls, not OTP.
              </p>
            </div>

            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 }}>
                Recharge amount (USD)
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg-input)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12, padding: '0 14px', height: 52,
              }}>
                <span style={{ color: BRAND, fontWeight: 800, fontSize: 18 }}>$</span>
                <input
                  type="number"
                  min={USDT_FLOOR}
                  step="1"
                  value={customRaw !== '' ? customRaw : (selectedPackage ? '' : String(amount))}
                  onChange={(e) => onCustomChange(e.target.value)}
                  placeholder="12"
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    color: 'var(--text-1)', fontSize: 16, fontWeight: 600, height: '100%',
                  }}
                />
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                Type any amount — crypto minimum is ${USDT_FLOOR}. Card still from ${CARD_MIN}.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 1.2 }}>CARD · $2–${CARD_MAX}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {PACKAGES.filter((p) => CARD_PACKAGE_SET.has(p.price)).map((p) => {
                const selected = amount === p.price && customRaw === '';
                return (
                  <button
                    key={p.id}
                    className="amt-tile"
                    type="button"
                    onClick={() => pickPackage(p.price)}
                    style={{
                      position: 'relative',
                      padding: '16px 8px 12px',
                      borderRadius: 14,
                      border: selected ? `2px solid ${BRAND}` : '1px solid rgba(255,255,255,0.1)',
                      background: selected ? 'rgba(245,166,35,0.14)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: selected ? BRAND : '#fff' }}>${p.price}</p>
                    {p.badge && (
                      <span style={{
                        display: 'inline-block', marginTop: 6,
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(245,166,35,0.2)', color: BRAND,
                        border: '1px solid rgba(245,166,35,0.35)',
                      }}>
                        {p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: 1.2 }}>CRYPTO · FROM ${USDT_FLOOR}</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              {PACKAGES.filter((p) => CRYPTO_PACKAGE_SET.has(p.price)).map((p) => {
                const selected = amount === p.price && customRaw === '';
                return (
                  <button
                    key={p.id}
                    className="amt-tile"
                    type="button"
                    onClick={() => pickPackage(p.price)}
                    style={{
                      position: 'relative',
                      padding: '16px 8px 12px',
                      borderRadius: 14,
                      border: selected ? `2px solid ${BRAND}` : '1px solid rgba(255,255,255,0.1)',
                      background: selected ? 'rgba(245,166,35,0.14)' : 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: selected ? BRAND : '#fff' }}>${p.price}</p>
                    {p.badge && (
                      <span style={{
                        display: 'inline-block', marginTop: 6,
                        fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                        background: 'rgba(245,166,35,0.2)', color: BRAND,
                        border: '1px solid rgba(245,166,35,0.35)',
                      }}>
                        {p.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {canActivateFromWallet && (
              <button
                className="pay-btn"
                type="button"
                onClick={activateFromWallet}
                style={{
                  width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                  background: BRAND, color: '#000',
                  fontWeight: 800, fontSize: 16, cursor: 'pointer',
                  boxShadow: '0 8px 28px rgba(245,166,35,0.35)',
                }}
              >
                Activate {numberLabel || 'number'} with wallet →
              </button>
            )}

            <button
              className="pay-btn"
              type="button"
              onClick={continueToPay}
              disabled={!amount || amount < CARD_MIN}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                background: amount >= CARD_MIN ? (canActivateFromWallet ? 'rgba(255,255,255,0.08)' : BRAND) : 'rgba(255,255,255,0.06)',
                color: amount >= CARD_MIN ? (canActivateFromWallet ? '#fff' : '#000') : 'rgba(255,255,255,0.3)',
                fontWeight: 800, fontSize: 16,
                cursor: amount >= CARD_MIN ? 'pointer' : 'not-allowed',
                boxShadow: amount >= CARD_MIN && !canActivateFromWallet ? '0 8px 28px rgba(245,166,35,0.35)' : 'none',
              }}
            >
              {canActivateFromWallet ? 'Add more credits instead →' : 'Continue to payment →'}
            </button>

            {buyMode && (
              <button
                type="button"
                onClick={skipResume}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'transparent', color: 'rgba(255,255,255,0.55)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Skip for now — go to account
              </button>
            )}

            <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textAlign: 'center' }}>
              Card $2–${CARD_MAX} · Crypto from ${USDT_FLOOR} · Credits never expire
            </p>
          </div>
        )}

        {step === 'pay' && (
          <>
            <div style={{
              borderRadius: 16, padding: '14px 16px',
              background: 'rgba(245,166,35,0.1)',
              border: '1px solid rgba(245,166,35,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: 'var(--text-1)' }}>Pay ${amount}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                  {buyMode && numberLabel ? `Then we activate ${numberLabel}` : 'Same wallet · card or crypto'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStep('amount')}
                style={{ background: 'none', border: 'none', color: BRAND, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
              >
                Change
              </button>
            </div>

            <div style={{
              borderRadius: 16, padding: '14px 16px',
              background: (cryptoPrimary || fincraPrimary) ? 'rgba(245,166,35,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${(cryptoPrimary || fincraPrimary) ? 'rgba(245,166,35,0.28)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: (cryptoPrimary || fincraPrimary) ? BRAND : 'var(--text-1)' }}>
                {reason.title}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
                {reason.body}
              </p>
            </div>

            {fincraPrimary ? (
              <>
              <button
                className="pay-btn"
                type="button"
                onClick={handleFincraBuy}
                disabled={fincraLoading || amount < CARD_MIN || amount > CARD_MAX}
                style={{
                  width: '100%', padding: '18px 16px', borderRadius: 16, border: 'none',
                  background: BRAND,
                  color: '#000',
                  fontWeight: 800, fontSize: 16, cursor: fincraLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: '0 8px 28px rgba(245,166,35,0.35)',
                }}
              >
                {fincraLoading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Banknote size={18} />}
                {nairaLabel()}
              </button>
              {(typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) && (
                <button
                  type="button"
                  onClick={confirmFincraPending}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(245,166,35,0.35)',
                    background: 'rgba(245,166,35,0.08)', color: BRAND,
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  I already paid — credit wallet
                </button>
              )}
              </>
            ) : cryptoPrimary ? (
              <button
                className="pay-btn"
                type="button"
                onClick={() => handleCryptoBuy('USDT_TRC20')}
                disabled={!usdtAllowed || cryptoLoading}
                style={{
                  width: '100%', padding: '18px 16px', borderRadius: 16, border: 'none',
                  background: usdtAllowed ? BRAND : 'rgba(255,255,255,0.06)',
                  color: usdtAllowed ? '#000' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 16, cursor: usdtAllowed && !cryptoLoading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: usdtAllowed ? '0 8px 28px rgba(245,166,35,0.35)' : 'none',
                }}
              >
                {cryptoLoading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={18} />}
                {usdtAllowed ? `Pay $${amount} with USDT` : `USDT starts at $${usdtMin}`}
              </button>
            ) : (
              <>
              {cardLocked && (
                <div style={{
                  marginBottom: 12, padding: 12, borderRadius: 12,
                  background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
                  color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.5,
                }}>
                  Card payments are locked after 3 declined attempts. You cannot try another card.
                  {' '}
                  <button type="button" onClick={() => navigate('/support')} style={{ background: 'none', border: 'none', color: BRAND, fontWeight: 800, cursor: 'pointer', padding: 0 }}>
                    Open your support ticket
                  </button>
                  {' '}or pay with crypto.
                </div>
              )}
              {!cardLocked && (
              <button
                className="pay-btn"
                type="button"
                onClick={handleCardBuy}
                disabled={!cardAllowed || cardLoading}
                style={{
                  width: '100%', padding: '18px 16px', borderRadius: 16, border: 'none',
                  background: cardAllowed ? BRAND : 'rgba(255,255,255,0.06)',
                  color: cardAllowed ? '#000' : 'rgba(255,255,255,0.3)',
                  fontWeight: 800, fontSize: 16, cursor: cardAllowed && !cardLoading ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: cardAllowed ? '0 8px 28px rgba(245,166,35,0.35)' : 'none',
                }}
              >
                {cardLoading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <CreditCard size={18} />}
                {cardAllowed ? `Pay $${amount} with card` : `Card max $${CARD_MAX}`}
              </button>
              )}
              </>
            )}

            <div style={{
              borderRadius: 20, background: 'var(--bg-card)',
              border: '1px solid var(--soft-border)',
              overflow: 'hidden',
            }}>
              {fincraEnabled && !fincraPrimary && (
                  <button
                    type="button"
                    onClick={handleFincraBuy}
                    disabled={fincraLoading || amount < CARD_MIN || amount > CARD_MAX}
                    style={{
                      width: '100%', padding: '16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      cursor: fincraLoading ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'rgba(245,166,35,0.15)',
                      border: '1px solid rgba(245,166,35,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {fincraLoading ? <Loader size={18} color={BRAND} style={{ animation: 'spin 1s linear infinite' }} /> : <Banknote size={20} color={BRAND} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Naira</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                        Nigerian cards · bank transfer · USSD
                      </p>
                    </div>
                    <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                  </button>
              )}
              {cryptoPrimary || fincraPrimary ? (
                <>
                  <button
                    type="button"
                    onClick={() => setStep('crypto')}
                    style={{
                      width: '100%', padding: '16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'rgba(245,166,35,0.15)',
                      border: '1px solid rgba(245,166,35,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Globe size={20} color={BRAND} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Other crypto</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                        USDT · TRX · LTC · XRP · 19 coins from $5
                      </p>
                    </div>
                    <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                  </button>
                  {!cardLocked && (
                  <button
                    type="button"
                    onClick={cardAllowed ? handleCardBuy : undefined}
                    disabled={!cardAllowed || cardLoading}
                    style={{
                      width: '100%', padding: '16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: 'none', border: 'none',
                      cursor: cardAllowed && !cardLoading ? 'pointer' : 'not-allowed',
                      opacity: cardAllowed ? 1 : 0.5,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {cardLoading ? <Loader size={18} color="#fff" style={{ animation: 'spin 1s linear infinite' }} /> : <CreditCard size={20} color="rgba(255,255,255,0.7)" />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Card</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                        {cardTooNew
                          ? `Unlocks after ${CARD_ACCOUNT_AGE_HOURS}h on this account`
                          : !cardAllowed
                            ? `Max $${CARD_MAX} — use USDT for this amount`
                            : 'Visa · Mastercard · Apple Pay · Google Pay · Link · local methods'}
                      </p>
                    </div>
                    <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                  </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleCryptoBuy('USDT_TRC20')}
                    disabled={!usdtAllowed || cryptoLoading}
                    style={{
                      width: '100%', padding: '16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: 'none', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      cursor: usdtAllowed && !cryptoLoading ? 'pointer' : 'not-allowed',
                      opacity: usdtAllowed ? 1 : 0.5,
                      textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'rgba(245,166,35,0.15)',
                      border: '1px solid rgba(245,166,35,0.35)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {cryptoLoading ? <Loader size={18} color={BRAND} style={{ animation: 'spin 1s linear infinite' }} /> : <Globe size={20} color={BRAND} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
                        Pay ${amount} with USDT
                      </p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                        Works worldwide · same wallet as card
                      </p>
                    </div>
                    <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep('crypto')}
                    style={{
                      width: '100%', padding: '16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: 'none', border: 'none',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 12,
                      background: 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Globe size={20} color="rgba(255,255,255,0.7)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Other crypto</p>
                      <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-2)' }}>USDT · TRX · LTC · XRP · from $5</p>
                    </div>
                    <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                  </button>
                </>
              )}
            </div>

            {buyMode && (
              <button
                type="button"
                onClick={skipResume}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
                  background: 'transparent', color: 'rgba(255,255,255,0.55)',
                  fontWeight: 700, fontSize: 14, cursor: 'pointer',
                }}
              >
                Skip for now — go to account
              </button>
            )}

            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.5 }}>
              One wallet · credits never expire · number activates after this payment
            </p>
          </>
        )}

        {step === 'crypto' && (
          <div style={{
            borderRadius: 20, background: 'var(--bg-card)',
            border: '1px solid rgba(245,166,35,0.22)',
            padding: '20px 18px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 800, fontSize: 16, color: 'var(--text-1)' }}>Pay ${amount} with crypto</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-2)' }}>
                Any coin below · ${USDT_FLOOR} minimum · pay the address we show you
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              {CRYPTO_COINS.map((c) => {
                const isSel = c.id === selectedCoinId;
                const tooHigh = amount < coinMin(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={tooHigh}
                    onClick={() => setSelectedCoinId(c.id)}
                    style={{
                      padding: '12px 6px', borderRadius: 12,
                      border: isSel ? `2px solid ${BRAND}` : '1px solid rgba(255,255,255,0.1)',
                      background: isSel ? 'rgba(245,166,35,0.12)' : 'rgba(255,255,255,0.03)',
                      cursor: tooHigh ? 'not-allowed' : 'pointer',
                      opacity: tooHigh ? 0.35 : 1,
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: isSel ? BRAND : '#fff' }}>
                      {c.label}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, color: 'var(--text-2)', fontWeight: 600 }}>{c.sub}</p>
                  </button>
                );
              })}
            </div>

            {!cryptoAllowed && (
              <p style={{ margin: 0, fontSize: 12, color: BRAND }}>
                This coin needs at least ${cryptoMin}. Change the amount.
              </p>
            )}

            <button
              className="pay-btn"
              type="button"
              onClick={() => handleCryptoBuy()}
              disabled={!cryptoAllowed || cryptoLoading}
              style={{
                width: '100%', padding: '16px 0', borderRadius: 14, border: 'none',
                background: cryptoAllowed ? BRAND : 'rgba(255,255,255,0.06)',
                color: cryptoAllowed ? '#000' : 'rgba(255,255,255,0.3)',
                fontWeight: 800, fontSize: 16,
                cursor: cryptoAllowed && !cryptoLoading ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: cryptoAllowed ? '0 8px 28px rgba(245,166,35,0.35)' : 'none',
              }}
            >
              {cryptoLoading ? <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} /> : null}
              {cryptoAllowed
                ? `Continue with ${CRYPTO_COINS.find((c) => c.id === selectedCoinId)?.label || 'Crypto'} →`
                : 'Select a valid coin'}
            </button>
          </div>
        )}
      </div>

      {cryptoOrder && (
        <CryptoModal
          order={cryptoOrder}
          onClose={() => setCryptoOrder(null)}
          onSuccess={handleCryptoSuccess}
          coinLabel={CRYPTO_COINS.find((c) => c.id === selectedCoinId)?.label || 'Crypto'}
        />
      )}
    </div>
  );
};

export default BuyCreditsPage;
