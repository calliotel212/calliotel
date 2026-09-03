import React, { useState, useEffect } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Trash2, Search, User, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d   = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const dayMs = 86400000;
  if (diff < dayMs && d.getDate() === now.getDate()) return 'Today';
  if (diff < 2 * dayMs) return 'Yesterday';
  const day = d.getDate();
  const mo  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  const y   = d.getFullYear();
  return `${day} ${mo} ${y}`;
};

const formatDuration = (seconds) => {
  if (!seconds || seconds === 0) return 'No answer';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

const CallHistoryPage = () => {
  const [calls, setCalls]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [balance, setBalance]     = useState(0);
  const [myNumbers, setMyNumbers] = useState([]);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [showNumberPicker, setShowNumberPicker] = useState(false);
  const [search, setSearch]       = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const h = { Authorization: `Bearer ${token}` };
      const [callsRes, walletRes, numsRes] = await Promise.allSettled([
        axios.get(`${API}/telecom/calls/history`, { headers: h }),
        axios.get(`${API}/wallet/balance`, { headers: h }),
        axios.get(`${API}/numbers/my-numbers`, { headers: h }),
      ]);
      if (callsRes.status === 'fulfilled')  setCalls(callsRes.value.data.calls || []);
      if (walletRes.status === 'fulfilled') setBalance(walletRes.value.data.balance || 0);
      if (numsRes.status === 'fulfilled') {
        const nums = numsRes.value.data.numbers || [];
        setMyNumbers(nums);
        if (nums.length > 0) setSelectedNumber(nums[0].phone_number);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDeleteCall = async (callId) => {
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.delete(`${API}/telecom/calls/${callId}`, { headers: { Authorization: `Bearer ${token}` } });
      setCalls(prev => prev.filter(c => c.id !== callId));
    } catch {
      toast({ title: 'Could not delete', variant: 'destructive' });
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Delete all call history?')) return;
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.delete(`${API}/telecom/calls/history`, { headers: { Authorization: `Bearer ${token}` } });
      setCalls([]);
      toast({ title: 'Call history cleared' });
    } catch {
      toast({ title: 'Could not clear history', variant: 'destructive' });
    }
  };

  const isMissed = (call) =>
    call.status === 'missed' || call.status === 'no-answer' ||
    (!call.duration && call.direction === 'inbound');

  // Filter by search
  const filtered = calls.filter(call => {
    if (!search) return true;
    const contact = call.direction === 'inbound' ? call.from_number : call.to_number;
    return (contact || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: 57 }}>

      {/* ── Top bar: number selector + balance ── */}
      <div className="sticky top-0 z-20" style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--soft-border-2)' }}>
        <div className="max-w-lg mx-auto px-4 h-11 flex items-center justify-between">
          {/* Number selector */}
          <button
            onClick={() => myNumbers.length > 1 && setShowNumberPicker(p => !p)}
            className="flex items-center gap-1 text-sm font-medium"
            style={{ color: 'var(--text-1)', background: 'none', border: 'none', cursor: myNumbers.length > 1 ? 'pointer' : 'default' }}>
            {myNumbers.length > 1 && <ChevronDown style={{ width: 16, height: 16, color: 'var(--text-2)' }} />}
            <span>{selectedNumber || 'Call History'}</span>
          </button>

          {/* Balance */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm" style={{ color: AMBER }}>${Number(balance).toFixed(2)}</span>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: AMBER }} />
          </div>
        </div>

        {/* Number picker dropdown */}
        {showNumberPicker && myNumbers.length > 1 && (
          <div className="absolute left-0 right-0 z-30 max-w-lg mx-auto"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid #2a2a2a' }}>
            {myNumbers.map(n => (
              <button key={n.phone_number}
                onClick={() => { setSelectedNumber(n.phone_number); setShowNumberPicker(false); }}
                className="w-full flex items-center justify-between px-5 py-3 text-left"
                style={{ background: n.phone_number === selectedNumber ? '#2a1a0a' : 'transparent', border: 'none', cursor: 'pointer' }}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{n.phone_number}</p>
                  <p className="text-xs" style={{ color: 'var(--text-2)' }}>{n.country}</p>
                </div>
                {n.phone_number === selectedNumber && <div className="w-2 h-2 rounded-full" style={{ background: AMBER }} />}
              </button>
            ))}
          </div>
        )}

        {/* Amber bar */}
        <div className="max-w-lg mx-auto px-4 h-11 flex items-center justify-between"
          style={{ background: AMBER }}>
          <span className="font-bold text-base tracking-wide" style={{ color: '#111' }}>All</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/recordings')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', fontWeight: 700, fontSize: 13 }}
            >
              Recordings
            </button>
            <button
              onClick={() => navigate('/voicemail')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#111', fontWeight: 700, fontSize: 13 }}
            >
              Voicemail
            </button>
            {calls.length > 0 && (
              <button onClick={handleClearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                <Trash2 className="w-5 h-5" style={{ color: '#111' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto">

        {/* ── Search ── */}
        <div className="px-4 pt-3 pb-2" style={{ background: 'var(--bg-page)' }}>
          <div className="relative">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search"
              className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm focus:outline-none"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--soft-border)', color: 'var(--text-1)', boxShadow: 'none' }}
            />
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: AMBER }} />
          </div>
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
              style={{ borderColor: AMBER, borderTopColor: 'transparent' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <div style={{ width: 72, height: 72, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Phone style={{ width: 32, height: 32, color: 'var(--text-3)' }} />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-1)' }}>
              {search ? 'No results' : 'No calls yet'}
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-2)', maxWidth: 280 }}>
              {search ? 'Try a different search' : 'The calls you make or receive will appear here.'}
            </p>
            {!search && (
              <button type="button" onClick={() => navigate('/keypad')}
                style={{ padding: '12px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#F5A623,#e8940f)', color: '#111', fontWeight: 800, fontSize: 14 }}>
                Open keypad
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--soft-border-2)' }}>
            {filtered.map(call => {
              const contact  = call.direction === 'inbound' ? call.from_number : call.to_number;
              const viaNum   = call.direction === 'inbound' ? call.to_number   : call.from_number;
              const callCount = call.count || 1;
              const missed   = isMissed(call);
              const isVoicemail = call.status === 'voicemail' || call.has_voicemail;
              const hasRecording = Boolean(call.has_recording);
              const dirLabel = call.direction === 'inbound' ? (missed ? 'Missed' : 'Incoming') : 'Outgoing';
              const contactColor = missed ? '#dc2626' : 'var(--text-1)';

              return (
                <div key={call.id}
                  className="flex items-center gap-3 px-4 py-3.5"
                  style={{ borderBottom: '1px solid var(--soft-border)', background: 'var(--bg-card)' }}>

                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: missed ? 'rgba(220,38,38,0.12)' : 'rgba(245,166,35,0.16)' }}>
                    {missed
                      ? <PhoneMissed className="w-5 h-5" style={{ color: '#dc2626' }} />
                      : call.direction === 'inbound'
                        ? <PhoneIncoming className="w-5 h-5" style={{ color: AMBER }} />
                        : <PhoneOutgoing className="w-5 h-5" style={{ color: AMBER }} />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span style={{ fontWeight: 800, fontSize: 16, color: contactColor, letterSpacing: '-0.2px' }}>
                        {contact || 'Unknown'}
                      </span>
                      {callCount > 1 && (
                        <span className="text-xs font-bold" style={{ color: AMBER }}>({callCount})</span>
                      )}
                      {isVoicemail && (
                        <button
                          type="button"
                          onClick={() => navigate('/voicemail')}
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed', fontSize: 10, border: 'none', cursor: 'pointer', fontWeight: 700 }}
                        >
                          Voicemail
                        </button>
                      )}
                      {hasRecording && (
                        <button
                          type="button"
                          onClick={() => navigate('/recordings')}
                          className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: 'rgba(245,166,35,0.18)', color: '#b45309', fontSize: 10, border: 'none', cursor: 'pointer', fontWeight: 700 }}
                        >
                          Recording
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize: 13, marginTop: 3, color: 'var(--text-2)', fontWeight: 600 }}>
                      <span style={{ color: missed ? '#dc2626' : AMBER }}>{dirLabel}</span>
                      {' · '}
                      {call.duration > 0 ? formatDuration(call.duration) : 'No answer'}
                      {call.cost > 0 && <span style={{ color: AMBER }}> · ${parseFloat(call.cost).toFixed(2)}</span>}
                    </p>
                    <p style={{ fontSize: 12, marginTop: 2, color: 'var(--text-3)' }}>
                      {viaNum && <span>{viaNum} · </span>}
                      {formatDate(call.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => contact && navigate(`/keypad?number=${encodeURIComponent(contact)}`)}
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(245,166,35,0.18)', border: 'none', cursor: 'pointer' }}
                      title="Call back">
                      <Phone className="w-4 h-4" style={{ color: AMBER }} />
                    </button>
                    <button
                      onClick={() => handleDeleteCall(call.id)}
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--soft-fill)', border: 'none', cursor: 'pointer' }}
                      title="Delete">
                      <Trash2 className="w-4 h-4" style={{ color: 'var(--text-3)' }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default CallHistoryPage;
