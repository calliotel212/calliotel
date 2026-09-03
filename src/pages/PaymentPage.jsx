import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, Zap, Lock, Loader, CreditCard, CheckCircle, AlertCircle, ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PRESETS   = [5, 10, 15, 20, 50];
const MIN_AMT   = 5;
const MAX_AMT   = 500;

const PaymentPage = () => {
  const [tab, setTab]                 = useState('crypto');
  const [selectedAmt, setSelectedAmt] = useState(10);
  const [customAmt, setCustomAmt]     = useState('');
  const [useCustom, setUseCustom]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [balance, setBalance]         = useState(null);
  const [cardError, setCardError]     = useState('');

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate  = useNavigate();

  useEffect(() => {
    const token = safeLocalStorage.getItem('token');
    if (!token) return;
    axios.get(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setBalance(r.data.balance))
      .catch(() => {});
  }, []);

  const getAmount = () => {
    if (useCustom) {
      const v = parseFloat(customAmt);
      return isNaN(v) ? 0 : v;
    }
    return selectedAmt;
  };

  // ── Stripe card payment (redirect to hosted checkout) ─────────────────────
  const handleCardPay = async () => {
    if (!user) { toast({ title: 'Login required', variant: 'destructive' }); return; }
    const amount = getAmount();
    if (amount < MIN_AMT) { toast({ title: `Minimum $${MIN_AMT}`, variant: 'destructive' }); return; }
    if (amount > 20) { toast({ title: 'Maximum $20 for card payments', variant: 'destructive' }); return; }

    setLoading(true);
    setCardError('');
    try {
      const token = safeLocalStorage.getItem('token');
      const { data } = await axios.post(
        `${API}/payments/stripe/create-checkout`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data?.session_url) { window.location.href = data.session_url; return; }
      throw new Error('No checkout URL returned');
    } catch (error) {
      const msg = error?.response?.data?.detail || error?.message || 'Could not start checkout. Please try again.';
      setCardError(msg);
      toast({ title: 'Checkout failed', description: msg, variant: 'destructive' });
      setLoading(false);
    }
  };

  // ── Crypto payment (NOWPayments) ───────────────────────────────────────────
  const handleCryptoPay = async () => {
    if (!user) { toast({ title: 'Login required', variant: 'destructive' }); return; }
    const amount = getAmount();
    if (amount < MIN_AMT) { toast({ title: `Minimum $${MIN_AMT}`, variant: 'destructive' }); return; }
    if (amount > MAX_AMT) { toast({ title: `Maximum $${MAX_AMT}`, variant: 'destructive' }); return; }
    setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const { data } = await axios.post(
        `${API}/payments/nowpayments/create-invoice`,
        { amount },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (data?.invoice_url) { window.location.href = data.invoice_url; return; }
      throw new Error('No checkout URL returned');
    } catch (error) {
      const msg = error?.response?.data?.detail || error?.message || 'Please try again.';
      toast({ title: 'Could not start payment', description: msg, variant: 'destructive' });
      setLoading(false);
    }
  };

  const amt    = getAmount();
  const canPay = amt >= MIN_AMT && amt <= MAX_AMT;

  return (
    <div className="min-h-screen text-white" style={{ background: '#060610' }}>
      <style>{`
        .preset-btn { transition: all 0.18s ease; cursor: pointer; }
        .preset-btn:hover { transform: translateY(-1px); }
        .pay-tab { transition: all 0.2s; cursor: pointer; border: none; background: none; }
      `}</style>

      {/* Header */}
      <header style={{ background: 'rgba(6,6,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate('/wallet')} style={{ padding: 8, borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}>
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Add Balance</h1>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
              Current balance: {balance === null ? '…' : <strong style={{ color: '#10b981' }}>${typeof balance === 'number' ? balance.toFixed(2) : balance}</strong>}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Trust strip */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
          {[
            { icon: <Shield className="w-4 h-4" />, text: 'Secure & Encrypted', col: '#10b981' },
            { icon: <Zap className="w-4 h-4" />,    text: 'Instant Activation', col: '#10b981' },
            { icon: <Lock className="w-4 h-4" />,   text: 'Credits Never Expire', col: '#a78bfa' },
          ].map((t, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
              <span style={{ color: t.col }}>{t.icon}</span>{t.text}
            </span>
          ))}
        </div>

        {/* Payment method tabs */}
        <div style={{ display: 'flex', gap: 10, padding: 5, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          {[
            { id: 'card',   label: '💳 Credit / Debit Card', sub: 'Visa, Mastercard, Amex · PayPal' },
            { id: 'crypto', label: '₿ Cryptocurrency',       sub: 'BTC, USDT, ETH & 300+ more' },
          ].map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} className="pay-tab" onClick={() => { setTab(t.id); setCardError(''); }}
                style={{ flex: 1, padding: '14px 10px', borderRadius: 12, textAlign: 'center',
                  background: active ? 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.15))' : 'transparent',
                  border: active ? '1px solid rgba(99,102,241,0.45)' : '1px solid transparent',
                  boxShadow: active ? '0 4px 16px rgba(99,102,241,0.15)' : 'none',
                }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: active ? '#a5b4fc' : 'rgba(255,255,255,0.5)', marginBottom: 2 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: active ? 'rgba(165,180,252,0.7)' : 'rgba(255,255,255,0.25)' }}>{t.sub}</div>
              </button>
            );
          })}
        </div>

        {/* Amount selector */}
        <div style={{ borderRadius: 20, padding: '22px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2 }}>Select Amount</p>
            <button onClick={() => { setUseCustom(!useCustom); setCustomAmt(''); }}
              style={{ fontSize: 12, fontWeight: 700, color: useCustom ? '#a78bfa' : 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer' }}>
              {useCustom ? '← Presets' : 'Custom amount'}
            </button>
          </div>

          {!useCustom ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {PRESETS.map(p => {
                const isSel = selectedAmt === p;
                return (
                  <div key={p} className="preset-btn" onClick={() => setSelectedAmt(p)}
                    style={{
                      padding: '16px 8px', borderRadius: 14, textAlign: 'center',
                      background: isSel ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.02)',
                      border: `2px solid ${isSel ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`,
                      boxShadow: isSel ? '0 0 20px rgba(99,102,241,0.2)' : 'none',
                    }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: isSel ? '#a5b4fc' : 'rgba(255,255,255,0.85)' }}>${p}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{p} credits</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>$</span>
              <input type="number" value={customAmt} onChange={e => setCustomAmt(e.target.value)}
                placeholder={`Enter amount (min $${MIN_AMT} – max $${MAX_AMT})`}
                style={{ width: '100%', padding: '18px 18px 18px 38px', borderRadius: 14, fontSize: 20, fontWeight: 700, background: 'rgba(255,255,255,0.04)', border: '2px solid rgba(255,255,255,0.1)', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = 'rgba(99,102,241,0.5)'}
                onBlur={e => e.target.style.borderColor  = 'rgba(255,255,255,0.1)'}
              />
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8, paddingLeft: 4 }}>Minimum ${MIN_AMT} · Maximum ${MAX_AMT}</p>
            </div>
          )}

          {canPay && (
            <div style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>Credits added to wallet</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#a5b4fc' }}>${amt.toFixed ? amt.toFixed(2) : amt}</div>
            </div>
          )}
          {!canPay && amt > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#f87171' }} />
              <span style={{ fontSize: 13, color: '#f87171' }}>Please enter an amount between ${MIN_AMT} and ${MAX_AMT}.</span>
            </div>
          )}
        </div>


        {/* CARD TAB — 2Checkout hosted checkout */}
        {tab === 'card' && (
          <div style={{ borderRadius: 20, padding: '22px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', gap: 16 }}>

            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2 }}>Pay by Card or PayPal</p>

            {/* Info box */}
            <div style={{ padding: '16px', borderRadius: 14, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#a5b4fc', marginBottom: 6 }}>Secure Hosted Checkout</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                You'll be redirected to a secure payment page. Pay with Visa, Mastercard, Amex, or PayPal. Credits are added instantly after confirmation.
              </div>
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.2)', fontSize: 12, color: 'rgba(245,166,35,0.85)' }}>
                ℹ️ Daily card limit: <strong>$20</strong> — multiple payments allowed until you reach $20/day.
              </div>
            </div>


            {cardError && (
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle className="w-4 h-4" style={{ color: '#f87171', flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: '#f87171' }}>{cardError}</span>
              </div>
            )}

            <button onClick={handleCardPay} disabled={!canPay || loading}
              style={{
                width: '100%', padding: '20px 0', borderRadius: 16, fontSize: 17, fontWeight: 900,
                border: 'none', cursor: canPay && !loading ? 'pointer' : 'not-allowed',
                background: canPay && !loading
                  ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)'
                  : 'rgba(255,255,255,0.06)',
                color: canPay && !loading ? '#fff' : 'rgba(255,255,255,0.25)',
                boxShadow: canPay && !loading ? '0 8px 32px rgba(99,102,241,0.4)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                transition: 'all 0.2s',
              }}>
              {loading
                ? <><Loader className="w-5 h-5 animate-spin" /> Opening secure checkout…</>
                : <><CreditCard className="w-5 h-5" /><ExternalLink className="w-4 h-4" /> Pay ${canPay ? (amt.toFixed ? amt.toFixed(2) : amt) : '—'} by Card</>
              }
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>
              <Shield className="w-3 h-3" /> 3D Secure · 256-bit SSL · Secured by Stripe · Max $20
            </div>
          </div>
        )}


        {/* CRYPTO TAB */}
        {tab === 'crypto' && (
          <div style={{ borderRadius: 20, padding: '22px 20px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2 }}>Cryptocurrency Payment</p>

            <div style={{ padding: '16px', borderRadius: 14, background: 'rgba(247,147,26,0.08)', border: '1px solid rgba(247,147,26,0.25)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 6 }}>300+ Cryptocurrencies Accepted</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Pay with Bitcoin, USDT (TRC20/ERC20), Ethereum, Litecoin, XRP, and 300+ more. You'll be redirected to a secure checkout page.
              </div>
            </div>

            <button onClick={handleCryptoPay} disabled={!canPay || loading}
              style={{
                width: '100%', padding: '20px 0', borderRadius: 16, fontSize: 17, fontWeight: 900,
                border: 'none', cursor: canPay && !loading ? 'pointer' : 'not-allowed',
                background: canPay && !loading
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : 'rgba(255,255,255,0.06)',
                color: canPay && !loading ? '#fff' : 'rgba(255,255,255,0.25)',
                boxShadow: canPay && !loading ? '0 8px 32px rgba(245,158,11,0.3)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                transition: 'all 0.2s',
              }}>
              {loading
                ? <><Loader className="w-5 h-5 animate-spin" /> Opening secure checkout…</>
                : <>₿ Pay ${canPay ? (amt.toFixed ? amt.toFixed(2) : amt) : '—'} with Crypto</>
              }
            </button>

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.6 }}>
              You will be redirected to NOWPayments secure hosted checkout. Credits are added instantly after confirmation.
            </p>
          </div>
        )}

        {/* Accepted methods */}
        <div style={{ borderRadius: 16, padding: '18px 20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 14, textAlign: 'center' }}>Accepted Payment Methods</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {[
              { label: 'Bitcoin',     color: '#f7931a22',             text: '#f7931a' },
              { label: 'USDT',        color: '#26a17b22',             text: '#26a17b' },
              { label: 'Ethereum',    color: '#627eea22',             text: '#627eea' },
              { label: '300+ Crypto', color: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.4)' },
            ].map(m => (
              <div key={m.label} style={{ padding: '6px 12px', borderRadius: 8, background: m.color, border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, fontWeight: 700, color: m.text }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', paddingBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
            <Shield className="w-4 h-4" /> Secured with 256-bit encryption
          </div>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>Credits are added instantly after payment confirmation.</p>
        </div>

      </div>
    </div>
  );
};

export default PaymentPage;
