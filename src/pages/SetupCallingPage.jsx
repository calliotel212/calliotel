import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, ArrowRight, Loader, Check } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import BottomNav from '../components/BottomNav';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

const _e164 = (n) => {
  if (!n) return '';
  let s = String(n).replace(/\s/g, '').trim();
  if (s.startsWith('00')) s = `+${s.slice(2)}`;
  const digits = s.replace(/[^0-9+]/g, '').replace(/\+/g, '');
  if (!digits) return '';
  return `+${digits}`;
};

const isValidE164 = (p) => /^\+[1-9]\d{6,14}$/.test(p || '');

/**
 * Optional: forward inbound calls to a personal phone.
 * Outbound calling does NOT need this — use Keypad with your Calliotel number.
 */
const SetupCallingPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [virtualNumber, setVirtualNumber] = useState(searchParams.get('number') || '');
  const [bridgeInput, setBridgeInput] = useState('');
  const [existingBridge, setExistingBridge] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const goKeypad = () => {
    const q = virtualNumber ? `?number=${encodeURIComponent(virtualNumber)}` : '';
    navigate(`/keypad${q}`);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const token = safeLocalStorage.getItem('token');
        const h = { Authorization: `Bearer ${token}` };
        const [bridgeRes, numsRes] = await Promise.allSettled([
          axios.get(`${API}/calls/bridge-phone`, { headers: h }),
          axios.get(`${API}/numbers/my-numbers`, { headers: h }),
        ]);
        if (bridgeRes.status === 'fulfilled') {
          const b = bridgeRes.value.data.bridge_phone || '';
          setExistingBridge(b);
          if (b) setBridgeInput(b);
        }
        if (!virtualNumber && numsRes.status === 'fulfilled') {
          const nums = (numsRes.value.data.numbers || []).filter((n) => n.status === 'active');
          if (nums[0]?.phone_number) setVirtualNumber(nums[0].phone_number);
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [virtualNumber]);

  const handleSave = async () => {
    const cleaned = _e164(bridgeInput.trim());
    if (!isValidE164(cleaned)) {
      toast({
        title: 'Include country code',
        description: 'e.g. +1 for US, +44 for UK, +56 for Chile',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(
        `${API}/calls/bridge-phone`,
        { forward_to: cleaned },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (virtualNumber) {
        try {
          await axios.post(
            `${API}/numbers/${encodeURIComponent(virtualNumber)}/forwarding`,
            { forward_to: cleaned, enabled: true },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        } catch {
          /* forwarding optional */
        }
      }
      toast({ title: 'Inbound forward saved' });
      goKeypad();
    } catch (err) {
      toast({
        title: 'Could not save',
        description: err.response?.data?.detail || 'Try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader className="animate-spin" style={{ color: AMBER, width: 28, height: 28 }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-1)', paddingBottom: 80 }}>
      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 24px' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #F5A623, #e8940f)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 12px 36px rgba(245,166,35,0.35)',
          }}
        >
          <Phone style={{ width: 30, height: 30, color: '#111' }} />
        </div>

        <h1 style={{ fontSize: 24, fontWeight: 900, textAlign: 'center', marginBottom: 8, lineHeight: 1.25 }}>
          You’re ready to call
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--text-2)', fontSize: 14, marginBottom: 8, lineHeight: 1.5 }}>
          Dial from the keypad with your Calliotel number. No personal phone required — like FunnyTel / call.com.
        </p>
        {virtualNumber && (
          <p style={{ textAlign: 'center', color: AMBER, fontSize: 13, fontWeight: 700, marginBottom: 22, fontFamily: 'monospace' }}>
            {virtualNumber}
          </p>
        )}

        <button
          type="button"
          onClick={goKeypad}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #F5A623, #e8940f)',
            color: '#111',
            fontWeight: 800,
            fontSize: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 22,
          }}
        >
          Open keypad <ArrowRight style={{ width: 18, height: 18 }} />
        </button>

        <div
          style={{
            background: 'var(--soft-fill-2)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: '16px',
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-2)', marginBottom: 6 }}>
            Optional: forward inbound calls
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.45 }}>
            Only if you want missed/inbound rings on your personal phone. Outbound calling does not need this.
          </p>

          {isValidE164(_e164(existingBridge)) ? (
            <div
              style={{
                background: 'rgba(245,166,35,0.1)',
                border: '1px solid rgba(245,166,35,0.3)',
                borderRadius: 12,
                padding: '10px 12px',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Check style={{ width: 16, height: 16, color: AMBER }} />
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                Forward set: <strong style={{ color: 'var(--text-1)' }}>{existingBridge}</strong>
              </span>
            </div>
          ) : null}

          <input
            type="tel"
            value={bridgeInput}
            onChange={(e) => setBridgeInput(e.target.value)}
            placeholder="+1 555 000 1234"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '12px 14px',
              fontSize: 15,
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              background: '#121218',
              color: 'var(--text-1)',
              outline: 'none',
              marginBottom: 10,
            }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !bridgeInput.trim()}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.12)',
              cursor: saving || !bridgeInput.trim() ? 'not-allowed' : 'pointer',
              background: 'transparent',
              color: 'rgba(255,255,255,0.75)',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {saving ? 'Saving…' : 'Save inbound forward'}
          </button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default SetupCallingPage;
