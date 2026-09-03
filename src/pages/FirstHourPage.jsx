import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { peekPendingNumberPurchase, setAuthRedirect } from '../utils/authRedirect';
import { suggestedFundAmount } from '../utils/firstHour';
import safeLocalStorage from '../utils/safeLocalStorage';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Single door for the first-hour funnel.
 * Pending number + enough balance → activate.
 * Pending number + short wallet → pay once.
 * No pending → pick a number.
 */
export default function FirstHourPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [have, setHave] = useState(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setHave(0);
      return;
    }
    const token = safeLocalStorage.getItem('token');
    if (!token) {
      setHave(0);
      return;
    }
    let cancelled = false;
    axios.get(`${API}/wallet/balance`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!cancelled) setHave(Number(r.data.balance ?? 0)); })
      .catch(() => { if (!cancelled) setHave(0); });
    return () => { cancelled = true; };
  }, [user, loading]);

  useEffect(() => {
    if (loading || have == null) return;

    const pending = peekPendingNumberPurchase();

    if (!user) {
      if (pending) {
        setAuthRedirect('/first-hour');
        navigate('/signup?next=/first-hour', { replace: true });
        return;
      }
      navigate('/browse-numbers?first=1', { replace: true });
      return;
    }

    if (!pending?.area_code) {
      navigate('/browse-numbers?first=1', { replace: true });
      return;
    }

    const price = Number(pending.price || pending.amount || 0);
    if (price > 0 && have >= price) {
      navigate('/browse-numbers?autopurchase=1', { replace: true });
      return;
    }

    const amount = suggestedFundAmount(pending);
    navigate(`/buy-credits?amount=${amount}&resume=1&pay=1`, { replace: true });
  }, [user, have, loading, navigate]);

  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#080810', padding: 20,
    }}>
      <div role="status" aria-live="polite" style={{
        width: '100%', maxWidth: 380, padding: '30px 24px',
        borderRadius: 24, background: '#15151c',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
      }}>
        <div style={{
          width: 42, height: 42, margin: '0 auto 18px', borderRadius: '50%',
          border: '3px solid rgba(245,166,35,0.2)',
          borderTopColor: '#F5A623',
          animation: 'spin 0.7s linear infinite',
        }} />
        <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 900, textAlign: 'center', margin: 0 }}>
          Preparing your number
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.58)', fontSize: 13, textAlign: 'center', lineHeight: 1.5, margin: '8px 0 20px' }}>
          We are checking your wallet and restoring your selected number.
        </p>
        {[
          ['1', 'Number selected'],
          ['2', have == null ? 'Checking wallet balance…' : 'Wallet checked'],
          ['3', 'Opening payment or activation'],
        ].map(([step, label], index) => (
          <div key={step} style={{
            display: 'flex', alignItems: 'center', gap: 11,
            marginTop: index ? 9 : 0, color: index < 2 ? '#fff' : 'rgba(255,255,255,0.5)',
            fontSize: 13, fontWeight: 700,
          }}>
            <span style={{
              width: 24, height: 24, borderRadius: 12, flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: index < 2 ? 'rgba(245,166,35,0.16)' : 'rgba(255,255,255,0.06)',
              color: index < 2 ? '#F5A623' : 'rgba(255,255,255,0.42)',
              border: `1px solid ${index < 2 ? 'rgba(245,166,35,0.38)' : 'rgba(255,255,255,0.08)'}`,
            }}>
              {step}
            </span>
            {label}
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
