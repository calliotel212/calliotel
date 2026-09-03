import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, ChevronRight, CheckCircle, AlertCircle, Loader, Copy, Check, UserPlus } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import BottomNav from '../components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

const inputStyle = {
  width: '100%',
  background: 'var(--bg-input, #16161f)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 14,
  padding: '14px 16px',
  color: '#fff',
  fontSize: 15,
  outline: 'none',
};

const TransferPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [recipientId, setRecipientId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => { fetchBalance(); }, []);

  const fetchBalance = async () => {
    setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.get(`${API}/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBalance(res.data.balance ?? 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const copyMyId = async () => {
    if (user?.client_id) {
      try {
        await navigator.clipboard.writeText(user.client_id);
        setCopied(true);
        toast({ title: 'Copied!', description: 'Your Account Number copied' });
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({ title: 'Copy failed', description: 'Please copy manually', variant: 'destructive' });
      }
    }
  };

  const handleSend = async () => {
    setError('');
    const amt = parseFloat(amount);
    if (!recipientId.trim()) return setError('Enter recipient Account Number');
    if (!amt || amt <= 0) return setError('Enter a valid amount');
    if (amt > balance) return setError(`Insufficient balance. You have $${balance.toFixed(2)}`);
    setSubmitting(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(`${API}/wallet/transfer-balance`, {
        recipient_client_id: recipientId.trim().toUpperCase(),
        amount: amt,
      }, { headers: { Authorization: `Bearer ${token}` } });
      setResult({
        amount: res.data.amount_transferred,
        recipient: res.data.recipient_client_id,
        recipientEmail: res.data.recipient_email,
        newBalance: res.data.new_balance,
      });
      setBalance(res.data.new_balance);
    } catch (e) {
      setError(e.response?.data?.detail || 'Transfer failed. Check the Account Number and try again.');
    } finally { setSubmitting(false); }
  };

  if (result) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-24" style={{ background: 'var(--bg-page)' }}>
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(245,166,35,0.15)' }}>
            <CheckCircle className="w-8 h-8" style={{ color: AMBER }} />
          </div>
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>Transfer Complete</h2>
          <p className="mb-1" style={{ color: 'var(--text-2)' }}>
            <span className="font-bold text-xl" style={{ color: AMBER }}>${result.amount.toFixed(2)}</span> sent to{' '}
            <span className="font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{result.recipient}</span>
          </p>
          {result.recipientEmail && (
            <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>({result.recipientEmail})</p>
          )}
          <div className="rounded-2xl p-4 mb-6" style={{ background: 'var(--bg-card)', border: '1px solid rgba(245,166,35,0.22)' }}>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>New Balance</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>${result.newBalance.toFixed(2)}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { setResult(null); setRecipientId(''); setAmount(''); setError(''); }}
              className="flex-1 py-3 rounded-xl font-semibold"
              style={{ background: 'var(--soft-fill)', color: 'var(--text-1)', border: '1px solid var(--soft-border)' }}>
              New Transfer
            </button>
            <button onClick={() => navigate('/account')}
              className="flex-1 py-3 rounded-xl font-extrabold"
              style={{ background: AMBER, color: '#111' }}>
              Done
            </button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: 'var(--bg-page)' }}>
      <header className="sticky top-0 z-20" style={{ background: 'rgba(6,6,16,0.95)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--soft-border-2)' }}>
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/account')}
            className="p-2 rounded-xl"
            style={{ background: 'var(--soft-fill)', border: '1px solid var(--soft-border)' }}>
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-1)' }}>Balance Transfer</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-6">
        <div className="rounded-2xl p-5 mb-5" style={{
          background: 'linear-gradient(165deg, #1a1610 0%, #12100c 100%)',
          border: '1px solid rgba(245,166,35,0.28)',
        }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: AMBER }}>
              <DollarSign className="w-5 h-5" style={{ color: '#111' }} />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: AMBER }}>Available Credit</p>
              <p className="text-[32px] font-black leading-none" style={{ color: '#fff' }}>
                {loading ? '…' : `$${balance.toFixed(2)}`}
              </p>
            </div>
          </div>
          {user?.client_id && (
            <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Your account</span>
              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-1)' }}>{user.client_id}</span>
              <button onClick={copyMyId} className="p-1 rounded">
                {copied
                  ? <Check className="w-3.5 h-3.5" style={{ color: AMBER }} />
                  : <Copy className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
                }
              </button>
            </div>
          )}
        </div>

        <p className="text-xs mb-4" style={{ color: 'var(--text-3)' }}>
          Credit can be transferred to Calliotel users only
        </p>

        <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-1)' }}>Send credit</p>

        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Account Number"
            value={recipientId}
            onChange={e => setRecipientId(e.target.value.toUpperCase())}
            className="font-mono"
            style={{ ...inputStyle, paddingRight: 44 }}
            onFocus={e => { e.target.style.borderColor = 'rgba(245,166,35,0.55)'; }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
          />
          <UserPlus className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--text-3)' }} />
        </div>

        <input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="Amount *"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="mb-4"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = 'rgba(245,166,35,0.55)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
        />

        {error && (
          <div className="flex items-center gap-2 rounded-xl p-3 mb-4" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)' }}>
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={submitting}
          className="w-full py-4 rounded-xl font-extrabold text-base disabled:opacity-50"
          style={{ background: AMBER, color: '#111', boxShadow: '0 10px 28px rgba(245,166,35,0.28)' }}>
          {submitting
            ? <span className="flex items-center justify-center gap-2"><Loader className="w-5 h-5 animate-spin" /> Processing…</span>
            : 'Send'
          }
        </button>

        <button
          onClick={() => navigate('/wallet')}
          className="w-full flex items-center justify-between py-4 mt-2 text-left"
          style={{ borderTop: '1px solid var(--soft-border-2)' }}>
          <span className="text-base font-medium" style={{ color: 'var(--text-1)' }}>Transaction History</span>
          <ChevronRight className="w-5 h-5" style={{ color: AMBER }} />
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default TransferPage;
