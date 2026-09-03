import React, { useState, useEffect, useRef } from 'react';
import {
  CreditCard, Plus, ArrowUpRight, ArrowDownRight, Loader,
  DollarSign, Send, X, ArrowLeft, TrendingUp, Wallet,
  ArrowLeftRight, Shield, Clock, ChevronDown, RefreshCw, Check
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import useGoBack from '../hooks/useGoBack';
import { useNavigate } from 'react-router-dom';
import safeLocalStorage from '../utils/safeLocalStorage';
import BottomNav from '../components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

/* ── Derive "mode" label from transaction ────────────────── */
function getMode(tx) {
  const d = (tx.description || '').toLowerCase();
  const src = (tx.source || tx.payment_method || '').toLowerCase();

  if (d.includes('transfer') || src.includes('transfer')) return 'Transfer';
  if (d.includes('apple') || src.includes('apple')) return 'Apple';
  if (d.includes('paypal') || src.includes('paypal')) return 'Paypal';
  if (
    tx.payment_session_id || d.includes('add balance') ||
    d.includes('stripe') || d.includes('card payment') || src.includes('stripe') ||
    d.includes('top up') || d.includes('topup') || d.includes('deposit') ||
    d.includes('package') || d.includes('bundle') || src.includes('package')
  ) return 'Add Balance';
  if (
    d.includes('did') || d.includes('virtual number') ||
    d.includes('number purchase') || d.includes('renewal') ||
    d.includes('auto-renew') || d.includes('auto renew')
  ) return 'DID';
  if (tx.type === 'credit') return 'Add Balance';
  return 'DID';
}

const MODE_OPTIONS = [
  { value: 'all',          label: 'All Transactions' },
  { value: 'Transfer',     label: 'Transfer' },
  { value: 'Add Balance',  label: 'Add Balance' },
  { value: 'Paypal',       label: 'Paypal' },
  { value: 'DID',          label: 'DID' },
];

/* ── Spending Mini-Chart ───────────────────────────────── */
function MiniChart({ transactions }) {
  const last7 = (() => {
    const days = {};
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
      days[key] = { amount: 0, weekday };
    }
    transactions
      .filter(t => t.type === 'debit')
      .forEach(t => {
        const d = new Date(t.created_at);
        const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (key in days) days[key].amount += t.amount;
      });
    return Object.entries(days);
  })();

  const max = Math.max(...last7.map(([, v]) => v.amount), 0.01);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 56 }}>
        {last7.map(([label, { amount }], i) => (
          <div key={i} title={`${label}: $${amount.toFixed(2)}`}
            style={{
              flex: 1, borderRadius: 6,
              height: `${Math.max((amount / max) * 100, amount > 0 ? 12 : 6)}%`,
              background: amount > 0
                ? `linear-gradient(to top, #b45309, ${AMBER})`
                : 'rgba(255,255,255,0.06)',
              transition: 'height 0.4s ease',
              minHeight: 4,
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {last7.map(([, { weekday }], i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: 'var(--text-3)', fontWeight: 500 }}>
            {weekday}
          </div>
        ))}
      </div>
    </div>
  );
}

const WalletPage = () => {
  const [balance, setBalance]           = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [modeFilter, setModeFilter]     = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef                     = useRef(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const goBack    = useGoBack('/dashboard');

  useEffect(() => {
    fetchWalletData();
  }, []);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchWalletData = async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    const token = safeLocalStorage.getItem('token');
    const h = { Authorization: `Bearer ${token}` };
    try {
      const [balRes, txRes] = await Promise.all([
        axios.get(`${API}/wallet/balance`, { headers: h }),
        axios.get(`${API}/wallet/transactions?limit=100`, { headers: h }),
      ]);
      setBalance(balRes.data.balance ?? 0);
      setTransactions(txRes.data.transactions || []);
    } catch {
      toast({ title: 'Error', description: 'Could not load wallet data', variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const isDebit  = (t) => t.type === 'debit' || t.amount < 0;
  const isCredit = (t) => !isDebit(t);
  const totalIn  = transactions.filter(isCredit).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalOut = transactions.filter(isDebit).reduce((s, t) => s + Math.abs(t.amount), 0);
  const txCount  = transactions.length;

  const filtered = transactions.filter(tx =>
    modeFilter === 'all' ? true : getMode(tx) === modeFilter
  );

  const selectedLabel = MODE_OPTIONS.find(o => o.value === modeFilter)?.label || 'All Transactions';

  return (
    <div className="min-h-screen text-white pb-20" style={{ background: 'var(--bg-page)' }}>
      <style>{`
        @keyframes balance-glow { 0%,100% { opacity:0.6 } 50% { opacity:1 } }
        .balance-glow { animation: balance-glow 4s ease-in-out infinite; }
        .wallet-card-hover { transition: all 0.3s ease; }
        .wallet-card-hover:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
        .tx-row:hover { background: rgba(245,166,35,0.06) !important; }
      `}</style>

      {/* Header */}
      <header style={{ background: 'rgba(6,6,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--soft-border-2)', position: 'sticky', top: 0, zIndex: 40 }}>
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => goBack()} style={{ padding: 8, borderRadius: 12, background: 'var(--soft-fill)', border: '1px solid var(--soft-border)', cursor: 'pointer', display: 'flex' }}>
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 16px rgba(245,166,35,0.35)' }}>
            <Wallet className="w-5 h-5" style={{ color: '#111' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Wallet</h1>
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Balance & transaction history</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => fetchWalletData(true)} style={{ padding: 8, borderRadius: 10, background: 'var(--soft-fill)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex' }}>
              <RefreshCw className={`w-4 h-4 text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => navigate('/sms')} style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Home</button>
          </div>
        </div>
      </header>


      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 120 }}>
          <div style={{ textAlign: 'center' }}>
            <Loader className="w-10 h-10 animate-spin" style={{ color: AMBER, margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-2)', fontSize: 14 }}>Loading your wallet...</p>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-8" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>


          {/* ── Balance Hero Card ─────────────────────────── */}
          <div style={{
            borderRadius: 22, padding: '28px 24px', position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(165deg, #1a1610 0%, #12100c 100%)',
            border: '1px solid rgba(245,166,35,0.28)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.35), 0 0 40px rgba(245,166,35,0.08)',
          }}>
            <div className="balance-glow" style={{ position: 'absolute', top: -50, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(245,166,35,0.12)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: AMBER, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 8 }}>Available Balance</p>
              <h2 style={{ fontSize: 'clamp(40px, 11vw, 52px)', fontWeight: 900, color: '#fff', lineHeight: 1, marginBottom: 18, letterSpacing: '-1.5px' }}>
                ${balance.toFixed(2)}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                  <Shield className="w-4 h-4" style={{ color: AMBER }} /> USD · Never expires
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => navigate('/buy-credits')} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800,
                    background: AMBER, border: 'none',
                    color: '#111', cursor: 'pointer',
                  }}>
                    <Plus className="w-4 h-4" /> Top Up
                  </button>
                  <button onClick={() => navigate('/transfer')} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    background: 'transparent', border: '1px solid rgba(245,166,35,0.35)',
                    color: AMBER, cursor: 'pointer',
                  }}>
                    <Send className="w-4 h-4" /> Transfer
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Stats Row ─────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Added', value: `+$${totalIn.toFixed(2)}`, color: AMBER, bg: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.18)', icon: <ArrowDownRight className="w-4 h-4" /> },
              { label: 'Total Spent', value: `-$${totalOut.toFixed(2)}`, color: '#f87171', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.15)', icon: <ArrowUpRight className="w-4 h-4" /> },
              { label: 'Transactions', value: txCount.toString(), color: 'var(--text-1)', bg: 'rgba(255,255,255,0.04)', border: 'var(--soft-border)', icon: <Clock className="w-4 h-4" /> },
            ].map((s, i) => (
              <div key={i} className="wallet-card-hover" style={{ borderRadius: 18, padding: '20px 18px', background: s.bg, border: `1px solid ${s.border}`, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, color: s.color, opacity: 0.8 }}>{s.icon}</div>
                <p style={{ fontSize: 22, fontWeight: 900, color: s.color, marginBottom: 4 }}>{s.value}</p>
                <p style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* ── Spending Chart ─────────────────────────────── */}
          {transactions.length > 0 && (
            <div style={{ borderRadius: 18, padding: '20px 22px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--soft-border-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp className="w-4 h-4" style={{ color: AMBER }} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>7-Day Spending</span>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Last 7 days</span>
              </div>
              <MiniChart transactions={transactions} />
            </div>
          )}

          {/* ── Top-Up CTA ─────────────────────────────────── */}
          <button onClick={() => navigate('/buy-credits')} style={{
            position: 'relative', width: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '20px 0', borderRadius: 18, fontSize: 16, fontWeight: 800,
            background: AMBER,
            color: '#111', border: 'none', cursor: 'pointer',
            boxShadow: '0 10px 32px rgba(245,166,35,0.28)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 14px 40px rgba(245,166,35,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 32px rgba(245,166,35,0.28)'; }}>
            <CreditCard className="w-5 h-5" /> Buy Credits
          </button>

          <button onClick={() => navigate('/transfer')} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '14px 0', borderRadius: 16, fontSize: 14, fontWeight: 600,
            background: 'var(--soft-fill-2)', border: '1px solid var(--soft-border)',
            color: 'var(--text-2)', cursor: 'pointer', transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.08)'; e.currentTarget.style.borderColor = 'rgba(245,166,35,0.28)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; }}>
            <ArrowLeftRight className="w-4 h-4" style={{ color: AMBER }} />
            Transfer Balance to Another Client
          </button>

          {/* ── Transaction History ──────────────────────── */}
          <div style={{ borderRadius: 20, overflow: 'visible', border: '1px solid var(--soft-border-2)', background: 'rgba(255,255,255,0.02)' }}>

            {/* Header row */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--soft-border-2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Transaction History</h3>

              {/* Dropdown filter */}
              <div ref={dropdownRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setDropdownOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: 'var(--soft-fill-2)', border: '1px solid var(--soft-border)',
                    color: AMBER, cursor: 'pointer', whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                  }}>
                  {selectedLabel}
                  <ChevronDown className="w-3.5 h-3.5" style={{ color: AMBER, transition: 'transform 0.2s', transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {dropdownOpen && (
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 100,
                    background: '#111118', border: '1px solid var(--soft-border)',
                    borderRadius: 14, overflow: 'hidden', minWidth: 180,
                    boxShadow: '0 16px 48px rgba(0,0,0,0.7)',
                  }}>
                    {MODE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setModeFilter(opt.value); setDropdownOpen(false); }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '12px 16px', fontSize: 14, fontWeight: 500,
                          background: modeFilter === opt.value ? 'rgba(245,166,35,0.12)' : 'transparent',
                          color: modeFilter === opt.value ? AMBER : 'rgba(255,255,255,0.75)',
                          border: 'none', cursor: 'pointer', textAlign: 'left',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => { if (modeFilter !== opt.value) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (modeFilter !== opt.value) e.currentTarget.style.background = 'transparent'; }}>
                        {opt.label}
                        {modeFilter === opt.value && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Table column headers */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px',
              padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.01)',
            }}>
              {['Date', 'Type', 'Mode', 'Amount'].map(col => (
                <span key={col} style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: col === 'Amount' ? 'right' : 'left' }}>
                  {col}
                </span>
              ))}
            </div>

            {/* Rows */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--soft-fill-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <DollarSign className="w-6 h-6" style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>No transactions found</p>
                <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                  {modeFilter === 'all' ? 'Add credits to get started' : `No ${selectedLabel} transactions yet`}
                </p>
              </div>
            ) : (
              filtered.map((tx, idx) => {
                const credit = tx.type === 'credit';
                const mode = getMode(tx);
                const dateStr = (() => {
                  try {
                    const d = new Date(tx.created_at);
                    return d.toISOString().split('T')[0];
                  } catch { return '—'; }
                })();
                const amtStr = credit
                  ? `$${Math.abs(tx.amount).toFixed(2)}`
                  : `-$${Math.abs(tx.amount).toFixed(2)}`;

                return (
                  <div
                    key={tx.id || idx}
                    className="tx-row"
                    style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 80px 90px',
                      alignItems: 'center',
                      padding: '13px 20px',
                      borderBottom: idx < filtered.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      transition: 'background 0.15s',
                    }}>

                    {/* Date */}
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', fontVariantNumeric: 'tabular-nums' }}>
                      {dateStr}
                    </span>

                    {/* Type */}
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: credit ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.55)',
                    }}>
                      {tx.type || (credit ? 'credit' : 'debit')}
                    </span>

                    {/* Mode */}
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                      {mode}
                    </span>

                    {/* Amount */}
                    <span style={{
                      fontSize: 14, fontWeight: 800, textAlign: 'right',
                      color: credit ? AMBER : '#f87171',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {amtStr}
                    </span>
                  </div>
                );
              })
            )}

            {/* Footer count */}
            {filtered.length > 0 && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
                  {modeFilter !== 'all' ? ` · ${selectedLabel}` : ''}
                </span>
              </div>
            )}
          </div>

        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default WalletPage;
