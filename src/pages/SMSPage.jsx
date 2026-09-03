import React, { useState, useEffect, useRef } from 'react';
import {
  Send, Loader, ArrowLeft,
  Search, ChevronRight,
  PenSquare, User, ChevronDown, MoreVertical
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';
import useGoBack from '../hooks/useGoBack';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  const y = d.getFullYear();
  const mo = d.getMonth() + 1;
  const day = d.getDate();
  return `${day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][mo-1]} ${String(y).slice(2)}`;
};

const fmtDateSep = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()}`;
};

const fmtFull = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const normalizeNumber = (num) => {
  if (!num) return '';
  const stripped = num.replace(/[\s\-()]/g, '');
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
};

const buildThreads = (messages, filterNumber = null) => {
  const map = {};
  for (const msg of messages) {
    const calliotelNum = normalizeNumber(msg.direction === 'inbound' ? msg.to_number : msg.from_number);
    const contact      = normalizeNumber(msg.direction === 'inbound' ? msg.from_number : msg.to_number);
    if (!contact || !calliotelNum) continue;
    if (filterNumber && calliotelNum !== filterNumber) continue;
    const key = `${calliotelNum}||${contact}`;
    if (!map[key]) map[key] = { contact, calliotelNum, messages: [], unread: 0 };
    map[key].messages.push(msg);
    if (msg.direction === 'inbound' && !msg.is_read) map[key].unread++;
  }
  return Object.values(map).sort((a, b) => {
    const la = a.messages[a.messages.length - 1]?.created_at || '';
    const lb = b.messages[b.messages.length - 1]?.created_at || '';
    return lb.localeCompare(la);
  });
};

// ── Thread View ────────────────────────────────────────────────────────────────
const ThreadView = ({ thread, onBack, onDelete, myNumbers, onSent }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const ownedNums = myNumbers.map(n => normalizeNumber(n.phone_number));
  const safeFrom = ownedNums.includes(normalizeNumber(thread.calliotelNum))
    ? normalizeNumber(thread.calliotelNum)
    : (ownedNums[0] || '');
  const [fromNumber, setFromNumber] = useState(safeFrom);
  const [localMessages, setLocalMessages] = useState(thread.messages);
  const { toast } = useToast();
  const bottomRef = useRef(null);

  useEffect(() => { setLocalMessages(thread.messages); }, [thread.messages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [localMessages]);

  useEffect(() => {
    if (thread?.unread > 0) {
      const token = safeLocalStorage.getItem('token');
      axios.post(`${API}/sms/mark-read-thread`, { contact_number: thread.contact },
        { headers: { Authorization: `Bearer ${token}` } })
        .then(() => { thread.unread = 0; thread.messages.forEach(m => { if (m.direction === 'inbound') m.is_read = true; }); onSent(); })
        .catch(() => {});
    }
  }, [thread?.contact]);

  const send = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || !fromNumber) return;
    setSending(true);
    const optimistic = {
      id: `tmp-${Date.now()}`,
      direction: 'outbound',
      from_number: fromNumber,
      to_number: thread.contact,
      text: body,
      created_at: new Date().toISOString(),
      is_read: true,
    };
    setLocalMessages(prev => [...prev, optimistic]);
    setText('');
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/sms/send`, {
        from_number: fromNumber, to_number: thread.contact, text: body
      }, { headers: { Authorization: `Bearer ${token}` } });
      onSent();
    } catch (err) {
      setLocalMessages(prev => prev.filter(m => m.id !== optimistic.id));
      toast({ title: 'Send failed', description: err.response?.data?.detail || 'Could not send SMS', variant: 'destructive' });
    } finally { setSending(false); }
  };

  const sorted = [...localMessages].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

  // Group messages by date for date separators
  const withSeps = [];
  let lastDate = '';
  for (const msg of sorted) {
    const d = fmtDateSep(msg.created_at);
    if (d && d !== lastDate) {
      withSeps.push({ type: 'sep', label: d, id: `sep-${d}` });
      lastDate = d;
    }
    withSeps.push({ type: 'msg', msg });
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 57px)' }}>
      {/* Thread header — amber bar */}
      <div style={{ background: AMBER }} className="flex items-center gap-3 px-3 py-3">
        <button onClick={onBack} className="p-1.5 rounded-full flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.15)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.25)' }}>
          <User className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base text-white truncate">{thread.contact}</p>
          <p className="text-xs text-white opacity-75 truncate">via {thread.calliotelNum}</p>
        </div>
        <button
          onClick={() => onDelete(thread.contact, thread.calliotelNum)}
          className="p-2 rounded-full flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.15)' }}>
          <MoreVertical className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4" style={{ background: 'var(--bg-page)' }}>
        <div className="space-y-2 max-w-lg mx-auto">
          {withSeps.map((item) => {
            if (item.type === 'sep') {
              return (
                <div key={item.id} className="flex items-center justify-center py-2">
                  <span className="text-xs px-3 py-1 rounded-full"
                    style={{ background: '#ddd', color: '#777', fontSize: 11 }}>
                    {item.label}
                  </span>
                </div>
              );
            }
            const { msg } = item;
            const isOut = msg.direction === 'outbound';
            return (
              <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                <div style={{
                  maxWidth: '80%',
                  background: isOut ? AMBER : 'var(--bg-card)',
                  border: isOut ? 'none' : '1px solid var(--soft-border)',
                  borderRadius: isOut ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '10px 14px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}>
                  <p className="text-sm leading-relaxed" style={{ color: isOut ? '#111' : 'var(--text-1)', fontWeight: 600 }}>{msg.text}</p>
                  <p className="text-xs mt-1" style={{ color: isOut ? 'rgba(0,0,0,0.5)' : 'var(--text-3)', textAlign: isOut ? 'right' : 'left' }}>
                    {fmtFull(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply bar */}
      <form onSubmit={send} style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--soft-border)' }} className="px-3 py-2">
        {myNumbers.length > 1 && (
          <select value={fromNumber} onChange={e => setFromNumber(e.target.value)}
            className="w-full mb-2 px-3 py-2 rounded-xl text-sm focus:outline-none"
            style={{ border: '1px solid #ddd', color: '#333', background: '#f7f7f7' }}>
            {myNumbers.map(n => <option key={n.phone_number} value={n.phone_number}>{n.phone_number}</option>)}
          </select>
        )}
        <div className="flex gap-2 items-center">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); } }}
            placeholder="Text message"
            maxLength={160}
            className="flex-1 px-4 py-2.5 rounded-full text-sm focus:outline-none"
            style={{ border: '1px solid #e0e0e0', color: '#333', background: '#f7f7f7' }}
          />
          <button type="submit" disabled={sending || !text.trim()}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-all"
            style={{ background: AMBER }}>
            {sending ? <Loader className="w-4 h-4 animate-spin text-white" /> : <Send className="w-4 h-4 text-white" />}
          </button>
        </div>
        <p className="text-[10px] mt-1 text-right" style={{ color: '#bbb' }}>{text.length}/160</p>
      </form>
    </div>
  );
};

// ── Compose New ────────────────────────────────────────────────────────────────
const ComposeNew = ({ myNumbers, defaultFrom, defaultTo = '', onBack }) => {
  const [fromNumber, setFromNumber] = useState(defaultFrom || myNumbers[0]?.phone_number || '');
  const [toNumber, setToNumber]     = useState(defaultTo);
  const [text, setText]             = useState('');
  const [sending, setSending]       = useState(false);
  const { toast } = useToast();

  const send = async (e) => {
    e.preventDefault();
    if (!fromNumber || !toNumber || !text) return;
    setSending(true);
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/sms/send`, { from_number: fromNumber, to_number: toNumber, text },
        { headers: { Authorization: `Bearer ${token}` } });
      toast({ title: 'SMS Sent!', description: `Message sent to ${toNumber}` });
      setToNumber(''); setText('');
    } catch (err) {
      toast({ title: 'Failed', description: err.response?.data?.detail || 'Could not send', variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <div style={{ background: '#fff', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: AMBER }}>
        <button onClick={onBack} className="p-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h2 className="text-base font-bold text-white flex-1">New Message</h2>
      </div>
      <form onSubmit={send} className="p-5 space-y-4">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#888' }}>From (your number)</label>
          <select value={fromNumber} onChange={e => setFromNumber(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={{ border: '1px solid #e0e0e0', color: '#333', background: '#f7f7f7' }}>
            {myNumbers.map(n => <option key={n.phone_number} value={n.phone_number}>{n.phone_number} ({n.country})</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#888' }}>To</label>
          <input type="tel" value={toNumber} onChange={e => setToNumber(e.target.value)}
            placeholder="+1 234 567 8900"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={{ border: '1px solid #e0e0e0', color: '#333', background: '#f7f7f7' }} required />
          <p className="text-xs mt-1" style={{ color: '#f59e0b' }}>International format: +1 for US, +44 for UK…</p>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#888' }}>Message</label>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder="Type your message…" rows={4} maxLength={160}
            className="w-full px-4 py-3 rounded-xl text-sm resize-none focus:outline-none"
            style={{ border: '1px solid #e0e0e0', color: '#333', background: '#f7f7f7' }} required />
          <p className="text-xs text-right mt-1" style={{ color: '#bbb' }}>{text.length}/160</p>
        </div>
        <button type="submit" disabled={sending}
          className="w-full py-3 font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-white"
          style={{ background: AMBER }}>
          {sending ? <><Loader className="w-4 h-4 animate-spin" /> Sending…</> : <><Send className="w-4 h-4" /> Send SMS</>}
        </button>
      </form>
    </div>
  );
};

// ── Main SMS Page ──────────────────────────────────────────────────────────────
const SMSPage = () => {
  const [tab, setTab]                     = useState('conversations');
  const [messages, setMessages]           = useState([]);
  const [myNumbers, setMyNumbers]         = useState([]);
  const [balance, setBalance]             = useState(0);
  const [loading, setLoading]             = useState(false);
  const [search, setSearch]               = useState('');
  const [activeThread, setActiveThread]   = useState(null);
  const [activeNumber, setActiveNumber]   = useState(null);
  const [showNumberPicker, setShowNumberPicker] = useState(false);
  const [prefilledTo, setPrefilledTo]     = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();
  const goBack = useGoBack('/account');
  const [searchParams] = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const fromParam = searchParams.get('from');

  useEffect(() => {
    const to = searchParams.get('to');
    if (to) { setPrefilledTo(to); setTab('compose'); }
    if (searchParams.get('welcome') === '1') setTab('compose');
    fetchAll();
    const onNew = () => fetchAll({ silent: true });
    window.addEventListener('sms:new', onNew);
    const iv = setInterval(() => fetchAll({ silent: true }), 10000);
    return () => {
      window.removeEventListener('sms:new', onNew);
      clearInterval(iv);
    };
  }, []);

  const fetchAll = async (opts = {}) => {
    const silent = !!opts.silent;
    if (!silent) setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const h = { Authorization: `Bearer ${token}` };
      const [numRes, msgRes, walletRes] = await Promise.allSettled([
        axios.get(`${API}/sms/my-numbers`, { headers: h }),
        axios.get(`${API}/sms/inbox`, { headers: h }),
        axios.get(`${API}/wallet/balance`, { headers: h })
      ]);
      if (numRes.status === 'fulfilled') {
        const nums = numRes.value.data.numbers || [];
        setMyNumbers(nums);
        const wanted = fromParam ? normalizeNumber(fromParam) : null;
        const match = wanted && nums.find(n => normalizeNumber(n.phone_number) === wanted);
        if (match) setActiveNumber(normalizeNumber(match.phone_number));
        else if (!activeNumber && nums.length > 0) setActiveNumber(normalizeNumber(nums[0].phone_number));
      }
      if (msgRes.status === 'fulfilled') {
        const newMsgs = msgRes.value.data.messages || [];
        setMessages(newMsgs);
        setActiveThread(prev => {
          if (!prev) return null;
          const allThreads = buildThreads(newMsgs);
          const match = allThreads.find(
            t => t.contact === prev.contact && t.calliotelNum === prev.calliotelNum
          );
          return match || prev;
        });
      }
      if (walletRes.status === 'fulfilled') setBalance(walletRes.value.data.balance || 0);
    } catch (e) { console.error(e); }
    finally { if (!silent) setLoading(false); }
  };

  const handleDeleteThread = (contact, calliotelNum) => {
    if (!window.confirm(`Delete all messages with ${contact}?`)) return;
    const token = safeLocalStorage.getItem('token');
    axios.post(`${API}/sms/delete-thread`, { contact_number: contact },
      { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setMessages(prev => prev.filter(m => {
          const c  = normalizeNumber(m.direction === 'inbound' ? m.from_number : m.to_number);
          const cn = normalizeNumber(m.direction === 'inbound' ? m.to_number   : m.from_number);
          return !(c === contact && cn === calliotelNum);
        }));
        setActiveThread(null);
        toast({ title: 'Conversation deleted' });
      })
      .catch(() => toast({ title: 'Failed to delete', variant: 'destructive' }));
  };

  const noNumbers = myNumbers.length === 0;
  const threads = buildThreads(messages, activeNumber);
  const filteredThreads = threads.filter(t =>
    t.contact.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: 57 }}>

      {/* ── Top bar: number selector + balance ── */}
      <div className="sticky top-0 z-20" style={{ background: 'var(--bg-page)', borderBottom: '1px solid var(--soft-border-2)' }}>
        <div className="max-w-lg mx-auto px-4 h-11 flex items-center justify-between">
          <button
            onClick={() => myNumbers.length > 1 && setShowNumberPicker(p => !p)}
            className="flex items-center gap-1 font-medium text-sm"
            style={{ color: 'var(--text-1)', background: 'none', border: 'none' }}>
            {myNumbers.length > 1 && <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-2)' }} />}
            <span>{activeNumber || 'No Caller ID'}</span>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm" style={{ color: AMBER }}>${balance.toFixed(2)}</span>
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: AMBER }} />
          </div>
        </div>

        {/* Number picker dropdown */}
        {showNumberPicker && myNumbers.length > 1 && (
          <div className="absolute left-0 right-0 z-30 max-w-lg mx-auto"
            style={{ background: 'var(--bg-card)', borderBottom: '1px solid #2a2a2a' }}>
            {myNumbers.map(n => {
              const norm = normalizeNumber(n.phone_number);
              return (
                <button key={norm}
                  onClick={() => { setActiveNumber(norm); setShowNumberPicker(false); setActiveThread(null); }}
                  className="w-full flex items-center justify-between px-5 py-3 text-left"
                  style={{ background: norm === activeNumber ? '#2a1a0a' : 'transparent', border: 'none', cursor: 'pointer' }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>{norm}</p>
                    <p className="text-xs" style={{ color: '#666' }}>{n.country}</p>
                  </div>
                  {norm === activeNumber && <div className="w-2 h-2 rounded-full" style={{ background: AMBER }} />}
                </button>
              );
            })}
          </div>
        )}

        {/* Amber SMS header bar */}
        <div className="max-w-lg mx-auto px-4 h-11 flex items-center justify-between"
          style={{ background: AMBER }}>
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="p-1"
            style={{ color: '#111', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-base tracking-widest" style={{ color: '#111' }}>SMS</span>
          {!noNumbers && (
            <button
              onClick={() => { setActiveThread(null); setTab('compose'); }}
              className="p-1"
              style={{ color: '#111', background: 'none', border: 'none', cursor: 'pointer' }}
              title="New SMS">
              <PenSquare className="w-5 h-5" />
            </button>
          )}
          {noNumbers && <div style={{ width: 28 }} />}
        </div>
      </div>

      <div className="max-w-lg mx-auto w-full flex flex-col">

        {isWelcome && !noNumbers && (
          <div style={{
            margin: '12px 16px 0',
            padding: '14px 16px',
            borderRadius: 14,
            background: 'rgba(245,166,35,0.12)',
            border: '1.5px solid rgba(245,166,35,0.45)',
          }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 15, color: AMBER }}>
              Your number is live
            </p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>
              {activeNumber ? `${activeNumber} · ` : ''}Send a first SMS below, or wait here for incoming texts and OTPs.
            </p>
          </div>
        )}

        {/* ── No numbers state ── */}
        {noNumbers ? (
          <div className="flex flex-col items-center justify-center px-6 text-center py-20">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
              style={{ background: 'rgba(245,166,35,0.15)', border: '1px solid rgba(245,166,35,0.3)' }}>
              <span style={{ fontSize: 40 }}>📱</span>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text-1)' }}>No Virtual Numbers Yet</h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-2)' }}>Get a virtual number to start sending and receiving SMS.</p>
            <button onClick={() => navigate('/browse-numbers')}
              className="px-6 py-3 font-semibold rounded-xl"
              style={{ background: AMBER, color: '#111' }}>
              Browse Numbers
            </button>
          </div>

        ) : activeThread ? (
          <ThreadView
            thread={activeThread}
            onBack={() => setActiveThread(null)}
            onDelete={handleDeleteThread}
            myNumbers={myNumbers}
            onSent={fetchAll}
          />

        ) : tab === 'compose' ? (
          <ComposeNew myNumbers={myNumbers} defaultFrom={activeNumber} defaultTo={prefilledTo} onBack={() => { setPrefilledTo(''); setTab('conversations'); }} />

        ) : (
          <>
            {/* Search */}
            <div className="px-4 pt-3 pb-2" style={{ background: 'var(--bg-page)' }}>
              <div className="relative">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search"
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--soft-border)', color: 'var(--text-1)', boxShadow: 'none' }} />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: AMBER }} />
              </div>
            </div>

            {/* Thread list */}
            <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-page)', borderTop: '1px solid var(--soft-border-2)' }}>
              {loading ? (
                <div className="flex justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
                    style={{ borderColor: AMBER, borderTopColor: 'transparent' }} />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                  <span style={{ fontSize: 48 }}>💬</span>
                  <h3 className="text-base font-bold mt-4 mb-1" style={{ color: 'var(--text-1)' }}>
                    {search ? 'No results' : 'No messages yet'}
                  </h3>
                  <p className="text-sm mb-4" style={{ color: 'var(--text-2)' }}>
                    {search ? 'Try a different search' : `No messages on ${activeNumber}`}
                  </p>
                  {!search && (
                    <button onClick={() => setTab('compose')}
                      className="px-5 py-2.5 text-white text-sm font-semibold rounded-xl flex items-center gap-2"
                      style={{ background: AMBER }}>
                      <PenSquare className="w-4 h-4" /> Compose
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  {filteredThreads.map(thread => {
                    const last = thread.messages[thread.messages.length - 1];
                    return (
                      <button
                        key={`${thread.calliotelNum}||${thread.contact}`}
                        onClick={() => setActiveThread(thread)}
                        className="w-full text-left flex items-center gap-3 px-4 py-3.5"
                        style={{ background: 'var(--bg-card)', border: 'none', borderBottom: '1px solid var(--soft-border)', cursor: 'pointer' }}>
                        <div className="relative flex-shrink-0">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center"
                            style={{ background: 'rgba(245,166,35,0.16)' }}>
                            <User className="w-5 h-5" style={{ color: AMBER }} />
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-1)' }}>{thread.contact}</span>
                            <span style={{ fontSize: 12, flexShrink: 0, marginLeft: 8, color: 'var(--text-3)', fontWeight: 600 }}>{fmtTime(last?.created_at)}</span>
                          </div>
                          <p style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-2)' }}>
                            {last?.direction === 'outbound' && <span style={{ color: AMBER, fontWeight: 700 }}>You: </span>}
                            {last?.text}
                          </p>
                        </div>

                        {/* Unread badge + chevron */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {thread.unread > 0 && (
                            <span className="text-white text-[10px] font-bold flex items-center justify-center"
                              style={{
                                background: AMBER,
                                borderRadius: 4,
                                minWidth: 20,
                                height: 20,
                                padding: '0 5px',
                              }}>
                              {thread.unread > 9 ? '9+' : thread.unread}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4" style={{ color: '#ccc' }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SMSPage;
