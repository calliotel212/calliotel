import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Check, Circle, Wallet, Phone, PhoneCall } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

const isValidE164 = (p) => /^\+[1-9]\d{6,14}$/.test(p || '');

/**
 * Shared 3-step setup checklist: Funds → Number → Callback phone.
 * Hides itself when all three are complete.
 */
const SetupChecklist = ({ compact = false }) => {
  const navigate = useNavigate();
  const { balance, user } = useAuth();
  const [hasNumber, setHasNumber] = useState(null);
  const [hasCallback, setHasCallback] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const token = safeLocalStorage.getItem('token');
        const h = { Authorization: `Bearer ${token}` };
        const [numsRes, bridgeRes] = await Promise.allSettled([
          axios.get(`${API}/numbers/my-numbers`, { headers: h }),
          axios.get(`${API}/calls/bridge-phone`, { headers: h }),
        ]);
        if (cancelled) return;
        if (numsRes.status === 'fulfilled') {
          const nums = (numsRes.value.data.numbers || []).filter((n) => n.status === 'active');
          setHasNumber(nums.length > 0);
        } else {
          setHasNumber(false);
        }
        if (bridgeRes.status === 'fulfilled') {
          setHasCallback(isValidE164(bridgeRes.value.data.bridge_phone || ''));
        } else {
          setHasCallback(false);
        }
      } catch {
        if (!cancelled) {
          setHasNumber(false);
          setHasCallback(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user]);

  const hasFunds = typeof balance === 'number' && balance >= 0.05;
  const steps = [
    {
      id: 'funds',
      label: 'Add funds',
      done: hasFunds,
      icon: Wallet,
      cta: 'Add funds',
      path: '/buy-credits?amount=5&pay=1',
    },
    {
      id: 'number',
      label: 'Get a number',
      done: !!hasNumber,
      icon: Phone,
      cta: 'Choose number',
      path: '/browse-numbers',
    },
    {
      id: 'callback',
      label: 'Set callback phone',
      done: !!hasCallback,
      icon: PhoneCall,
      cta: 'Set phone',
      path: '/setup-calling',
    },
  ];

  if (loading || !user) return null;
  if (hasFunds && hasNumber && hasCallback) return null;

  const next = steps.find((s) => !s.done) || steps[0];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div
      style={{
        margin: compact ? '0 0 12px' : '14px 16px 0',
        background: 'rgba(245,166,35,0.08)',
        border: '1px solid rgba(245,166,35,0.28)',
        borderRadius: 14,
        padding: compact ? '12px 14px' : '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: AMBER }}>
          Get ready to call
        </p>
        <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
          {doneCount}/3 done
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {s.done ? (
                <Check style={{ width: 16, height: 16, color: '#22c55e', flexShrink: 0 }} />
              ) : (
                <Circle style={{ width: 16, height: 16, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
              )}
              <Icon style={{ width: 14, height: 14, color: s.done ? '#22c55e' : 'rgba(255,255,255,0.4)' }} />
              <span
                style={{
                  fontSize: 13,
                  color: s.done ? 'rgba(255,255,255,0.45)' : '#fff',
                  textDecoration: s.done ? 'line-through' : 'none',
                  fontWeight: s.done ? 500 : 600,
                }}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigate(next.path)}
        style={{
          width: '100%',
          padding: '11px 14px',
          borderRadius: 12,
          border: 'none',
          cursor: 'pointer',
          background: AMBER,
          color: '#111',
          fontWeight: 800,
          fontSize: 14,
        }}
      >
        {next.cta} →
      </button>
    </div>
  );
};

export default SetupChecklist;
