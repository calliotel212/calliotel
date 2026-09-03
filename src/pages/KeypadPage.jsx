import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, ChevronDown, Delete, PhoneCall, X, Loader } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';
import {
  connectTelnyxClient,
  placeWebRtcCall,
  hangupWebRtcCall,
  disconnectTelnyxClient,
} from '../lib/telnyxWebRtc';
import { isTelegramMiniApp } from '../utils/telegramMiniApp';

function inAppWebViewBlocksMic() {
  if (typeof window === 'undefined') return false;
  if (isTelegramMiniApp()) return true;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|Instagram|Line\/|Twitter/i.test(ua);
}

function micErrorText(err) {
  const detail = err?.response?.data?.detail || err?.message || (typeof err === 'string' ? err : '') || '';
  return String(detail);
}

function isMicFailure(err) {
  return /microphone|Permission|getUserMedia|NotAllowed|NotFound|disabled|cannot connect/i.test(micErrorText(err));
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER  = '#F5A623';
/** Fallback until live quote returns (matches US-ish default) */
const FALLBACK_RATE = 0.02;

/** Strip junk and normalize toward E.164 (+digits). */
const _e164 = (n) => {
  if (!n) return '';
  let s = String(n).replace(/\s/g, '').trim();
  if (s.startsWith('00')) s = '+' + s.slice(2);
  const stripped = s.replace(/[^0-9+]/g, '');
  if (!stripped) return '';
  const digits = stripped.replace(/\+/g, '');
  if (!digits) return '';
  return stripped.startsWith('+') ? `+${digits}` : `+${digits}`;
};

/** Strict E.164: +[1-9] then 6–14 more digits (7–15 total). */
const isValidE164 = (p) => /^\+[1-9]\d{6,14}$/.test(p || '');

const KeypadPage = () => {
  const [phoneNumber, setPhoneNumber]       = useState('');
  const [myNumbers, setMyNumbers]           = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [loading, setLoading]               = useState(true);
  const [balance, setBalance]               = useState(null);
  const [showNumberPicker, setShowNumberPicker] = useState(false);

  const [bridgePhone, setBridgePhone]       = useState('');
  const [showSetupSheet, setShowSetupSheet] = useState(false);
  const [bridgeInput, setBridgeInput]       = useState('');
  const [savingBridge, setSavingBridge]     = useState(false);

  const [callStatus, setCallStatus]         = useState(null);
  const [callMessage, setCallMessage]       = useState('');
  const [callControlId, setCallControlId]   = useState(null);
  const [rateQuote, setRateQuote]           = useState(null);
  const [rateLoading, setRateLoading]       = useState(false);
  const [callMode, setCallMode]             = useState('app'); // 'app' | 'callback'
  const [callSeconds, setCallSeconds]       = useState(0);
  const [webrtcSessionId, setWebrtcSessionId] = useState(null);

  const deleteHoldRef = useRef(null);
  const zeroHoldRef   = useRef(null);
  const zeroConvertedRef = useRef(false);
  const inputRef      = useRef(null);
  const phoneRef      = useRef('');
  const callStatusRef = useRef(null);
  const setupRef      = useRef(false);
  const remoteAudioRef = useRef(null);
  const callTimerRef = useRef(null);
  const callStartedAtRef = useRef(null);
  const callAnsweredRef = useRef(false);
  const webrtcSessionRef = useRef(null);
  const selectedNumberRef = useRef(null);

  useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => { phoneRef.current = phoneNumber; }, [phoneNumber]);
  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { setupRef.current = showSetupSheet; }, [showSetupSheet]);
  useEffect(() => { selectedNumberRef.current = selectedNumber; }, [selectedNumber]);
  useEffect(() => { webrtcSessionRef.current = webrtcSessionId; }, [webrtcSessionId]);

  useEffect(() => () => {
    clearInterval(callTimerRef.current);
    disconnectTelnyxClient();
  }, []);

  useEffect(() => {
    const num = searchParams.get('number');
    if (num) setPhoneNumber(_e164(num) || num.replace(/[^0-9+*#]/g, '').slice(0, 20));
  }, [searchParams]);

  useEffect(() => { fetchData(); }, []);

  // Live destination rate as the user dials
  useEffect(() => {
    const dest = _e164(phoneNumber);
    if (!dest || dest.length < 4) {
      setRateQuote(null);
      setRateLoading(false);
      return undefined;
    }
    let cancelled = false;
    setRateLoading(true);
    const t = setTimeout(async () => {
      try {
        const token = safeLocalStorage.getItem('token');
        const r = await axios.get(`${API}/calls/rate`, {
          params: { to: dest },
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setRateQuote(r.data);
      } catch {
        if (!cancelled) {
          setRateQuote({
            rate_per_min: null,
            country: null,
            est_minutes: null,
            can_call: false,
            matched: false,
            error: true,
          });
        }
      } finally {
        if (!cancelled) setRateLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [phoneNumber, balance]);

  const fetchData = async () => {
    try {
      const token = safeLocalStorage.getItem('token');
      const h = { Authorization: `Bearer ${token}` };
      const [numsRes, walletRes, bridgeRes] = await Promise.allSettled([
        axios.get(`${API}/numbers/my-numbers`, { headers: h }),
        axios.get(`${API}/wallet/balance`, { headers: h }),
        axios.get(`${API}/calls/bridge-phone`, { headers: h }),
      ]);
      if (numsRes.status === 'fulfilled') {
        const nums = numsRes.value.data.numbers || [];
        setMyNumbers(nums);
        if (nums.length > 0) setSelectedNumber(nums[0].phone_number);
      }
      if (walletRes.status === 'fulfilled') {
        setBalance(walletRes.value.data.balance ?? 0);
      }
      if (bridgeRes.status === 'fulfilled') {
        setBridgePhone(bridgeRes.value.data.bridge_phone || '');
      }
    } catch (e) {
      console.error('Fetch failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectNumber = (num) => {
    setSelectedNumber(num);
    setShowNumberPicker(false);
  };

  const appendDigit = useCallback((digit) => {
    setPhoneNumber((prev) => {
      if (prev.length >= 20) return prev;
      // Keep * / # only for DTMF-style input mid-dial (not as sole destination)
      return prev + digit;
    });
  }, []);

  const handleDelete = useCallback(() => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  }, []);

  const stopCallTimer = () => {
    clearInterval(callTimerRef.current);
    callTimerRef.current = null;
  };

  const startCallTimer = () => {
    stopCallTimer();
    callStartedAtRef.current = Date.now();
    setCallSeconds(0);
    callTimerRef.current = setInterval(() => {
      if (!callStartedAtRef.current) return;
      setCallSeconds(Math.floor((Date.now() - callStartedAtRef.current) / 1000));
    }, 1000);
  };

  const reportWebRtcHangup = useCallback(async () => {
    const sid = webrtcSessionRef.current;
    if (!sid) return;
    const duration = callStartedAtRef.current
      ? Math.floor((Date.now() - callStartedAtRef.current) / 1000)
      : callSeconds;
    try {
      const token = safeLocalStorage.getItem('token');
      const r = await axios.post(`${API}/calls/webrtc/hangup`, {
        session_id: sid,
        duration_secs: Math.max(0, duration),
        answered: !!callAnsweredRef.current,
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (typeof r.data?.balance === 'number') setBalance(r.data.balance);
      if (r.data?.cost > 0) {
        toast({ title: `Call ended · $${Number(r.data.cost).toFixed(2)}` });
      }
    } catch (e) {
      console.warn('webrtc hangup bill failed', e);
    } finally {
      setWebrtcSessionId(null);
      webrtcSessionRef.current = null;
      callAnsweredRef.current = false;
      stopCallTimer();
    }
  }, [callSeconds, toast]);

  const placeWebRtcOutbound = useCallback(async () => {
    const dest = _e164(phoneRef.current.trim());
    const from = selectedNumberRef.current;
    if (!isValidE164(dest) || !from) return;

    setCallStatus('calling');
    setCallMessage('Connecting in-app…');
    setCallControlId(null);
    callAnsweredRef.current = false;
    setCallSeconds(0);

    try {
      if (inAppWebViewBlocksMic()) {
        throw new Error('Microphone is disabled in this in-app browser. Open calliotel.com in Safari, or use Call via phone.');
      }
      // Mic permission early
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone is disabled, cannot connect');
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      } catch (micErr) {
        throw new Error(micErrorText(micErr) || 'Microphone is disabled, cannot connect');
      }

      const token = safeLocalStorage.getItem('token');
      const h = { Authorization: `Bearer ${token}` };

      const [credRes, startRes] = await Promise.all([
        axios.get(`${API}/calls/webrtc-token`, { params: { to: dest }, headers: h }),
        axios.post(`${API}/calls/webrtc/start`, { from_number: from, to_number: dest }, { headers: h }),
      ]);

      const cred = credRes.data || {};
      const sessionId = startRes.data?.session_id;
      setWebrtcSessionId(sessionId);
      webrtcSessionRef.current = sessionId;

      await connectTelnyxClient({
        loginToken: cred.login_token,
        sipUsername: cred.sip_username,
        sipPassword: cred.sip_password,
      });

      setCallMessage('Calling…');
      placeWebRtcCall({
        destinationNumber: dest,
        callerNumber: from,
        remoteAudioEl: remoteAudioRef.current || undefined,
        onState: (state) => {
          if (state === 'trying' || state === 'requesting' || state === 'early') {
            setCallStatus('calling');
            setCallMessage('Calling…');
          } else if (state === 'ringing') {
            setCallStatus('ringing');
            setCallMessage(`Ringing ${dest}…`);
          } else if (state === 'active') {
            if (!callAnsweredRef.current) {
              callAnsweredRef.current = true;
              startCallTimer();
            }
            setCallStatus('active');
            setCallMessage('Connected');
          } else if (state === 'hangup' || state === 'destroy') {
            stopCallTimer();
            reportWebRtcHangup().finally(() => {
              disconnectTelnyxClient();
              setCallStatus(null);
              setCallMessage('');
            });
          } else if (state === 'purge') {
            /* ignore */
          }
        },
      });
      setCallStatus('ringing');
      setCallMessage(`Ringing ${dest}…`);
    } catch (err) {
      stopCallTimer();
      await disconnectTelnyxClient();
      const detail = micErrorText(err) || 'Could not start in-app call.';
      setCallStatus('error');
      if (isMicFailure(err) || inAppWebViewBlocksMic()) {
        setCallMode('callback');
        setCallMessage(
          inAppWebViewBlocksMic()
            ? 'In-app calling needs Safari (not Telegram). Or tap Call via my phone instead — we ring your personal phone, then connect.'
            : 'Microphone is blocked. Allow mic in Safari Settings for calliotel.com, or tap Call via my phone instead.',
        );
        setShowSetupSheet(true);
      } else {
        setCallMessage(detail);
      }
      if (webrtcSessionRef.current) {
        try {
          const token = safeLocalStorage.getItem('token');
          await axios.post(`${API}/calls/webrtc/hangup`, {
            session_id: webrtcSessionRef.current,
            duration_secs: 0,
            answered: false,
          }, { headers: { Authorization: `Bearer ${token}` } });
        } catch (_) { /* */ }
        setWebrtcSessionId(null);
        webrtcSessionRef.current = null;
      }
    }
  }, [reportWebRtcHangup]);

  const placeCall = useCallback(async (bridge) => {
    const dest = _e164(phoneRef.current.trim());
    if (!isValidE164(dest)) {
      toast({
        title: 'Invalid number',
        description: 'Enter full number with country code, e.g. +12025551234',
        variant: 'destructive',
      });
      return;
    }
    if (!isValidE164(_e164(bridge))) {
      setShowSetupSheet(true);
      return;
    }

    setCallStatus('calling');
    setCallMessage('Calling your phone…');
    try {
      const token = safeLocalStorage.getItem('token');
      const res = await axios.post(`${API}/calls/outbound`, {
        from_number: selectedNumber,
        to_number: dest,
        real_phone: _e164(bridge),
      }, { headers: { Authorization: `Bearer ${token}` } });
      setCallControlId(res.data.call_control_id || null);
      setCallStatus('ringing');
      setCallMessage(res.data.message || `Answer your phone (${bridge}) to connect to ${dest}`);
    } catch (err) {
      setCallStatus('error');
      const detail = err.response?.data?.detail || 'Could not initiate call.';
      setCallMessage(typeof detail === 'string' ? detail : 'Could not initiate call.');
    }
  }, [selectedNumber, toast]);

  const handleCall = useCallback(() => {
    const dest = _e164(phoneRef.current.trim());
    if (!dest || dest === '+') {
      toast({ title: 'Enter a number', variant: 'destructive' });
      return;
    }
    if (!isValidE164(dest)) {
      toast({
        title: 'Include country code',
        description: 'Use full international format, e.g. +56… for Chile, +1… for US',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedNumber) {
      toast({ title: 'No Calliotel number selected', variant: 'destructive' });
      return;
    }
    // Re-check balance vs live quote
    const quote = rateQuote;
    const rpm = quote?.rate_per_min != null ? Number(quote.rate_per_min) : null;
    const enough =
      quote?.can_call === true
      || (quote?.can_call !== false && rpm != null && balance != null && Number(balance) >= rpm);
    if (rpm != null && !enough) {
      toast({
        title: 'Not enough balance',
        description: `Need ~$${rpm.toFixed(2)} for 1 min. Add funds to call.`,
        variant: 'destructive',
      });
      navigate('/buy-credits');
      return;
    }
    if (callMode === 'app') {
      placeWebRtcOutbound();
      return;
    }
    if (!isValidE164(_e164(bridgePhone))) {
      setBridgeInput(bridgePhone || '');
      setShowSetupSheet(true);
      return;
    }
    placeCall(bridgePhone);
  }, [selectedNumber, bridgePhone, placeCall, placeWebRtcOutbound, callMode, toast, rateQuote, balance, navigate]);

  // Physical keyboard — stable listener (no stale closures)
  useEffect(() => {
    const onKey = (e) => {
      if (callStatusRef.current === 'calling' || callStatusRef.current === 'ringing') return;
      if (setupRef.current) return;
      // Let native input handle typing when focused
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCall();
        }
        return;
      }
      if (['0','1','2','3','4','5','6','7','8','9','*','#'].includes(e.key)) {
        e.preventDefault();
        appendDigit(e.key);
      } else if (e.key === '+') {
        e.preventDefault();
        setPhoneNumber((prev) => (prev.length === 0 ? '+' : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Delete') {
        e.preventDefault();
        setPhoneNumber('');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleCall();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [appendDigit, handleDelete, handleCall]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const cleaned = text.replace(/[^0-9+]/g, '').slice(0, 20);
      if (cleaned) setPhoneNumber(_e164(cleaned) || cleaned);
    } catch {
      toast({ title: 'Paste failed', description: 'Allow clipboard access or paste manually.', variant: 'destructive' });
    }
  };

  const startDeleteHold = () => {
    deleteHoldRef.current = setTimeout(() => setPhoneNumber(''), 600);
  };
  const cancelDeleteHold = () => clearTimeout(deleteHoldRef.current);

  const startZeroHold = () => {
    zeroConvertedRef.current = false;
    zeroHoldRef.current = setTimeout(() => {
      zeroConvertedRef.current = true;
      setPhoneNumber((prev) => {
        if (!prev) return '+';
        if (prev.endsWith('0')) return prev.slice(0, -1) + '+';
        return prev.includes('+') ? prev : `+${prev}`;
      });
    }, 500);
  };
  const cancelZeroHold = () => clearTimeout(zeroHoldRef.current);

  const handleSaveBridgeAndCall = async () => {
    const cleaned = _e164(bridgeInput.trim());
    if (!isValidE164(cleaned)) {
      toast({
        title: 'Invalid number',
        description: 'Include country code e.g. +1 for US, +56 for Chile',
        variant: 'destructive',
      });
      return;
    }
    setSavingBridge(true);
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/calls/bridge-phone`, { forward_to: cleaned },
        { headers: { Authorization: `Bearer ${token}` } });
      setBridgePhone(cleaned);
      setShowSetupSheet(false);
      setTimeout(() => placeCall(cleaned), 200);
    } catch (err) {
      toast({
        title: 'Could not save number',
        description: err.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingBridge(false);
    }
  };

  const handleEndCall = async () => {
    if (webrtcSessionRef.current) {
      hangupWebRtcCall();
      await reportWebRtcHangup();
      await disconnectTelnyxClient();
      setCallStatus(null);
      setCallMessage('');
      setCallControlId(null);
      return;
    }
    if (callControlId) {
      try {
        const token = safeLocalStorage.getItem('token');
        await axios.post(`${API}/calls/hangup`, { call_control_id: callControlId },
          { headers: { Authorization: `Bearer ${token}` } });
      } catch {}
    }
    setCallStatus(null);
    setCallMessage('');
    setCallControlId(null);
  };

  const keypadButtons = [
    { digit: '1', letters: '' },    { digit: '2', letters: 'ABC' }, { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' }, { digit: '5', letters: 'JKL' }, { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },{ digit: '8', letters: 'TUV' }, { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },    { digit: '0', letters: '+' },   { digit: '#', letters: '' },
  ];

  const headerLabel = selectedNumber || (loading ? '…' : 'No Number');
  const destPreview = _e164(phoneNumber);
  const ratePerMin = rateQuote?.rate_per_min != null ? Number(rateQuote.rate_per_min) : null;
  const estMinutes =
    rateQuote?.est_minutes != null
      ? Number(rateQuote.est_minutes)
      : balance != null && ratePerMin > 0
        ? Math.max(0, Math.floor(Number(balance) / ratePerMin))
        : null;
  const apiCanCall = rateQuote?.can_call;
  const hasEnough =
    apiCanCall === true
    || (apiCanCall !== false && ratePerMin != null && balance != null && Number(balance) >= ratePerMin);
  const lowBalance = isValidE164(destPreview) && !!selectedNumber && ratePerMin != null && !hasEnough;
  const canCall = isValidE164(destPreview) && !!selectedNumber && !lowBalance && !rateQuote?.error;
  const rateDisplay = ratePerMin != null ? `$${ratePerMin.toFixed(2)}` : (rateLoading ? '…' : '—');
  const countryLabel = rateQuote?.country && rateQuote.country !== 'Enter destination'
    ? rateQuote.country
    : null;
  const hasBridge = isValidE164(_e164(bridgePhone));

  if (callStatus === 'calling' || callStatus === 'ringing' || callStatus === 'active' || callStatus === 'error') {
    const fmt = `${Math.floor(callSeconds / 60)}:${String(callSeconds % 60).padStart(2, '0')}`;
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
        <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
        <div className="flex flex-col items-center gap-6 px-8 w-full max-w-sm text-center">
          {callStatus === 'error' ? (
            <>
              <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: '#3a1515' }}>
                <X className="w-10 h-10" style={{ color: '#ef4444' }} />
              </div>
              <p className="text-base font-semibold" style={{ color: '#ef4444' }}>Call Failed</p>
              <p className="text-sm leading-relaxed" style={{ color: '#999' }}>{callMessage}</p>
              {(String(callMessage || '').toLowerCase().includes('balance')
                || String(callMessage || '').toLowerCase().includes('insufficient')
                || String(callMessage || '').includes('402')) && (
                <button
                  type="button"
                  onClick={() => navigate('/buy-credits')}
                  className="px-8 py-3 rounded-xl font-semibold"
                  style={{ background: AMBER, color: '#111' }}
                >
                  Add funds
                </button>
              )}
              <button
                type="button"
                onClick={() => { setCallStatus(null); setCallMessage(''); }}
                className="px-8 py-3 rounded-xl font-semibold text-white"
                style={{ background: '#2a2a2a' }}>
                Back to Keypad
              </button>
              <button
                type="button"
                onClick={() => { setCallMode('callback'); setCallStatus(null); setCallMessage(''); }}
                style={{ background: 'none', border: 'none', color: AMBER, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Try call via my phone
              </button>
            </>
          ) : (
            <>
              <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
                <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: callStatus === 'active' ? '#4ade80' : '#fbbf24' }} />
                <div className="w-20 h-20 rounded-full flex items-center justify-center z-10" style={{ background: callStatus === 'active' ? '#22c55e' : AMBER }}>
                  <PhoneCall className="w-9 h-9 text-white" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-semibold" style={{ color: 'var(--text-1)' }}>{phoneNumber}</p>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: '#999' }}>
                  {callStatus === 'active' ? `Connected · ${fmt}` : callMessage}
                </p>
                {callMode === 'app' && callStatus !== 'active' && (
                  <p className="text-xs mt-2" style={{ color: '#555' }}>In-app call · mic required</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleEndCall}
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg"
                style={{ background: '#ef4444' }}>
                <PhoneOff className="w-7 h-7 text-white" />
              </button>
              <span className="text-sm" style={{ color: '#ef4444' }}>{callStatus === 'active' ? 'Hang up' : 'Cancel'}</span>
            </>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', paddingBottom: 57 }}>

      <div style={{ borderBottom: '1px solid var(--border-1)', padding: '0 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            {myNumbers.length > 1 ? (
              <button
                type="button"
                onClick={() => setShowNumberPicker(p => !p)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--text-1)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                <ChevronDown style={{ width: 16, height: 16, color: 'var(--text-2)' }} />
                {headerLabel}
              </button>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>
                <ChevronDown style={{ width: 16, height: 16, color: 'var(--text-2)' }} />
                {headerLabel}
              </span>
            )}
            {showNumberPicker && myNumbers.length > 1 && (
              <div style={{ position: 'absolute', top: 28, left: 0, background: 'var(--bg-card)', border: '1px solid var(--border-1)', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 200 }}>
                {myNumbers.map(n => (
                  <button
                    type="button"
                    key={n.phone_number}
                    onClick={() => handleSelectNumber(n.phone_number)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', fontSize: 14, color: n.phone_number === selectedNumber ? AMBER : 'var(--text-1)', fontWeight: n.phone_number === selectedNumber ? 700 : 500, background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    {n.phone_number}
                  </button>
                ))}
              </div>
            )}
          </div>

          {balance !== null && (
            <button
              type="button"
              onClick={() => navigate('/buy-credits')}
              title="Add funds"
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: Number(balance) < 1 ? 'rgba(245,166,35,0.15)' : 'transparent',
                border: Number(balance) < 1 ? '1px solid rgba(245,166,35,0.45)' : '1px solid transparent',
                borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: AMBER }}>${Number(balance).toFixed(2)}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#111', background: AMBER, borderRadius: 10, padding: '2px 8px' }}>
                {Number(balance) < 1 ? 'Add funds' : '+'}
              </span>
            </button>
          )}
        </div>
        {/* Default: in-app call (virtual number only). Via-phone is optional advanced. */}
        {inAppWebViewBlocksMic() && callMode === 'app' && (
          <div style={{ maxWidth: 480, margin: '0 auto 8px', padding: '10px 12px', borderRadius: 12, background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)' }}>
            <p style={{ fontSize: 12, color: 'var(--text-1)', margin: 0, lineHeight: 1.45, fontWeight: 600 }}>
              In-app calling needs Safari. Telegram and in-app browsers block the microphone.{' '}
              <button type="button" onClick={() => setCallMode('callback')} style={{ background: 'none', border: 'none', color: AMBER, fontWeight: 800, cursor: 'pointer', padding: 0, fontSize: 12, textDecoration: 'underline' }}>
                Call via my phone instead
              </button>
            </p>
          </div>
        )}
        {callMode === 'callback' && (
          <div style={{ maxWidth: 480, margin: '0 auto', paddingBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: AMBER, fontWeight: 700 }}>Via phone mode</span>
            <button
              type="button"
              onClick={() => setCallMode('app')}
              style={{ fontSize: 11, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Back to in-app calling
            </button>
          </div>
        )}
      </div>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {!loading && myNumbers.length === 0 && (
        <div style={{
          margin: '16px 16px 0',
          padding: '28px 20px',
          borderRadius: 16,
          textAlign: 'center',
          background: 'var(--soft-fill-2)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 10, opacity: 0.7 }}>📞</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text-1)', marginBottom: 8 }}>No number to call from</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, margin: '0 0 16px' }}>
            Get a virtual number first, then dial anyone from this keypad.
          </p>
          <button type="button" onClick={() => navigate('/browse-numbers')} style={{
            padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg,#F5A623,#e8940f)', color: '#111', fontWeight: 800, fontSize: 14,
          }}>
            Get a number
          </button>
        </div>
      )}

      {!loading && myNumbers.length > 0 && !hasBridge && (
        <button
          type="button"
          onClick={() => { setBridgeInput(bridgePhone || ''); setShowSetupSheet(true); }}
          style={{
            margin: '12px 16px 0',
            padding: '12px 14px',
            borderRadius: 14,
            textAlign: 'left',
            background: 'rgba(59,130,246,0.1)',
            border: '1px solid rgba(59,130,246,0.35)',
            cursor: 'pointer',
            width: 'calc(100% - 32px)',
            maxWidth: 448,
            alignSelf: 'center',
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 13, color: '#93c5fd', marginBottom: 4 }}>Receive calls on your phone</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.45 }}>
            Set a real mobile number so inbound calls ring you. If you miss it, callers go to voicemail.
          </div>
        </button>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 16px 12px', maxWidth: 400, margin: '0 auto', width: '100%' }}>

        {/* Editable number field — fixes paste/keyboard + shows country-code hint */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 64, position: 'relative', marginBottom: 4 }}>
          <input
            ref={inputRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phoneNumber}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9+*#]/g, '').slice(0, 20);
              setPhoneNumber(v);
            }}
            placeholder="+ country code"
            aria-label="Phone number to dial"
            style={{
              width: '100%',
              fontSize: phoneNumber.length > 12 ? 24 : 32,
              fontWeight: 300,
              color: 'var(--text-1)',
              letterSpacing: 2,
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              padding: '8px 40px 8px 8px',
            }}
          />
          {!phoneNumber && (
            <button
              type="button"
              onClick={handlePaste}
              style={{ position: 'absolute', right: 0, fontSize: 12, fontWeight: 600, color: AMBER, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
            >
              Paste
            </button>
          )}
        </div>
        {phoneNumber && !isValidE164(destPreview) && (
          <p style={{ textAlign: 'center', fontSize: 11, color: '#f59e0b', marginBottom: 8 }}>
            Add country code (e.g. +1, +44, +56) — local numbers won&apos;t connect
          </p>
        )}

        {/* Rate / estimated minutes — destination-based */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            padding: '6px 8px 14px',
            minHeight: 36,
          }}
        >
          {countryLabel && (
            <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>
              {countryLabel}{rateLoading ? ' …' : ''}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-2)',
              background: lowBalance ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
              border: lowBalance ? '1px solid rgba(239,68,68,0.35)' : '1px solid rgba(255,255,255,0.06)',
              borderRadius: 12,
              padding: '10px 12px',
            }}
          >
            <span>
              Rate{' '}
              <span style={{ color: AMBER, fontWeight: 800 }}>{rateDisplay}</span>
              <span style={{ color: 'var(--text-3)' }}>/min</span>
            </span>
            <span style={{ textAlign: 'right' }}>
              {lowBalance ? (
                <span style={{ color: '#f87171', fontWeight: 800 }}>Need funds for 1 min</span>
              ) : (
                <>
                  ~{' '}
                  <span style={{ color: AMBER, fontWeight: 800 }}>
                    {estMinutes == null ? '—' : `${estMinutes} min`}
                  </span>
                  {' '}left
                </>
              )}
            </span>
          </div>
          {lowBalance && (
            <button
              type="button"
              onClick={() => navigate('/buy-credits')}
              style={{
                border: 'none', borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
                background: AMBER, color: '#111', fontWeight: 800, fontSize: 13,
              }}
            >
              Add funds to call
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
          {keypadButtons.map((btn) => (
            <button
              type="button"
              key={btn.digit}
              onClick={() => {
                if (btn.digit === '0' && zeroConvertedRef.current) {
                  zeroConvertedRef.current = false;
                  return;
                }
                appendDigit(btn.digit);
              }}
              onPointerDown={() => {
                if (btn.digit === '0') startZeroHold();
              }}
              onPointerUp={() => {
                if (btn.digit === '0') cancelZeroHold();
              }}
              onPointerLeave={() => {
                if (btn.digit === '0') cancelZeroHold();
              }}
              style={{
                height: 72,
                borderRadius: '50%',
                background: 'var(--keypad-key-bg)',
                border: '1px solid var(--keypad-key-border)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 0.1s, transform 0.08s',
                userSelect: 'none',
                maxWidth: 90,
                margin: '0 auto',
                width: '100%',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--keypad-key-text)', lineHeight: 1.1 }}>{btn.digit}</span>
              {btn.letters && (
                <span style={{ fontSize: 10, color: 'var(--keypad-key-sub)', marginTop: 1, letterSpacing: 1.2, fontWeight: 700 }}>
                  {btn.letters}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', height: 70 }}>
          <button
            type="button"
            onClick={handleCall}
            disabled={!canCall}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: !canCall ? 'rgba(245,166,35,0.25)' : AMBER,
              border: 'none', cursor: !canCall ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(245,166,35,0.35)',
              transition: 'background 0.15s',
              touchAction: 'manipulation',
            }}
          >
            <Phone style={{ width: 26, height: 26, color: '#111' }} />
          </button>

          {phoneNumber.length > 0 && (
            <button
              type="button"
              onClick={handleDelete}
              onPointerDown={() => startDeleteHold()}
              onPointerUp={cancelDeleteHold}
              onPointerLeave={cancelDeleteHold}
              style={{
                position: 'absolute', right: 16,
                width: 44, height: 44, borderRadius: '50%',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                touchAction: 'manipulation',
              }}
            >
              <Delete style={{ width: 22, height: 22, color: 'var(--text-2)' }} />
            </button>
          )}
        </div>

        {callMode === 'callback' ? (
          <button
            type="button"
            onClick={() => {
              setBridgeInput(bridgePhone || '');
              setShowSetupSheet(true);
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              fontSize: 12,
              color: isValidE164(_e164(bridgePhone)) ? '#888' : AMBER,
              marginTop: 8,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            {isValidE164(_e164(bridgePhone))
              ? `Callback phone: ${bridgePhone} · tap to change`
              : 'Set callback phone for Via-phone mode →'}
          </button>
        ) : (
          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 10, marginBottom: 0 }}>
            Calling as your Calliotel number — no personal phone needed.{' '}
            <button
              type="button"
              onClick={() => setCallMode('callback')}
              style={{ background: 'none', border: 'none', color: AMBER, cursor: 'pointer', fontSize: 11, textDecoration: 'underline', padding: 0, fontWeight: 700 }}
            >
              Call via my phone instead
            </button>
          </p>
        )}

      </div>

      <BottomNav />

      {showSetupSheet && (
        <>
          <div
            onClick={() => setShowSetupSheet(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
              zIndex: 100,
            }}
          />
          <div style={{
            position: 'fixed', bottom: 57, left: 0, right: 0,
            background: 'var(--bg-card)',
            borderRadius: '20px 20px 0 0',
            padding: '24px 24px 28px',
            zIndex: 101,
            maxWidth: 480,
            margin: '0 auto',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
          }}>
            <div style={{ width: 36, height: 4, background: '#333', borderRadius: 2, margin: '0 auto 20px' }} />

            <button
              type="button"
              onClick={() => setShowSetupSheet(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
              <X style={{ width: 20, height: 20, color: '#666' }} />
            </button>

            <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
              Optional callback phone
            </p>

            <div style={{ background: 'var(--bg-page)', borderRadius: 12, padding: '12px 14px', marginBottom: 20 }}>
              <p style={{ fontSize: 12, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>
                Only for “Via phone” mode
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: AMBER, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#000' }}>1</span>
                <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4 }}>Normal calling uses your <strong style={{ color: 'var(--text-1)' }}>Calliotel number in-app</strong> — no personal phone</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#aaa' }}>2</span>
                <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4 }}>Via-phone is optional: we ring this number, then connect</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#aaa' }}>3</span>
                <span style={{ fontSize: 13, color: '#ccc', lineHeight: 1.4 }}>They still see your Calliotel caller ID</span>
              </div>
            </div>

            <label style={{ fontSize: 12, color: '#888', fontWeight: 600, display: 'block', marginBottom: 6 }}>
              CALLBACK PHONE (optional, with country code)
            </label>
            <input
              type="tel"
              value={bridgeInput}
              onChange={e => setBridgeInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveBridgeAndCall(); }}
              placeholder="+1 555 000 1234"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: 16,
                borderRadius: 12,
                border: '1px solid #333',
                background: 'var(--bg-page)',
                color: 'var(--text-1)',
                outline: 'none',
                marginBottom: 6,
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: 11, color: '#555', marginBottom: 18 }}>
              Include country code — e.g. +1 for US/Canada, +44 for UK, +56 for Chile. Used for outbound callbacks and inbound forwarding.
            </p>

            <button
              type="button"
              onClick={handleSaveBridgeAndCall}
              disabled={savingBridge || !bridgeInput.trim()}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                background: savingBridge || !bridgeInput.trim() ? '#7a3300' : AMBER,
                border: 'none',
                cursor: savingBridge || !bridgeInput.trim() ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                fontSize: 16,
                fontWeight: 700,
                color: 'var(--text-1)',
                transition: 'background 0.15s',
              }}
            >
              {savingBridge ? (
                <><Loader style={{ width: 18, height: 18 }} className="animate-spin" /> Saving…</>
              ) : phoneNumber.trim() ? (
                <><Phone style={{ width: 18, height: 18 }} /> Save & Call {phoneNumber}</>
              ) : (
                <><Phone style={{ width: 18, height: 18 }} /> Save number</>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default KeypadPage;
