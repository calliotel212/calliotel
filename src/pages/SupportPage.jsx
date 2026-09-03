import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, MessageSquare, Plus, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';
const ORANGE = '#FF6600';

const statusColor = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'open') return '#22c55e';
  if (v === 'answered' || v === 'in_progress') return AMBER;
  return '#888';
};

const statusLabel = (s) => {
  const v = (s || '').toLowerCase();
  if (v === 'in_progress') return 'answered';
  return v || 'open';
};

const SupportPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const authToken = token || safeLocalStorage.getItem('token');

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(searchParams.get('id') || null);
  const [ticket, setTicket] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const headers = useMemo(
    () => ({ Authorization: `Bearer ${authToken}` }),
    [authToken]
  );

  const loadTickets = useCallback(async () => {
    if (!authToken) return;
    try {
      setLoading(true);
      const res = await axios.get(`${API}/support/tickets`, { headers });
      setTickets(res.data.tickets || []);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not load tickets');
    } finally {
      setLoading(false);
    }
  }, [authToken, headers]);

  const loadTicket = useCallback(
    async (id) => {
      if (!authToken || !id) return;
      try {
        const res = await axios.get(`${API}/support/tickets/${id}`, { headers });
        setTicket(res.data);
      } catch (e) {
        toast.error(e?.response?.data?.detail || 'Could not load ticket');
        setTicket(null);
      }
    },
    [authToken, headers]
  );

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadTickets();
  }, [user, navigate, loadTickets]);

  useEffect(() => {
    if (selectedId) {
      loadTicket(selectedId);
      const t = setInterval(() => loadTicket(selectedId), 12000);
      return () => clearInterval(t);
    }
    setTicket(null);
  }, [selectedId, loadTicket]);

  const openTicket = (id) => {
    setSelectedId(id);
    setSearchParams(id ? { id } : {});
    setShowNew(false);
  };

  const createTicket = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast.error('Subject and message are required');
      return;
    }
    setSending(true);
    try {
      const res = await axios.post(
        `${API}/support/ticket`,
        { subject: subject.trim(), message: message.trim() },
        { headers }
      );
      toast.success('Ticket opened');
      setSubject('');
      setMessage('');
      setShowNew(false);
      await loadTickets();
      if (res.data?.ticket_id) openTicket(res.data.ticket_id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not create ticket');
    } finally {
      setSending(false);
    }
  };

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !selectedId) return;
    setSending(true);
    try {
      await axios.post(
        `${API}/support/tickets/${selectedId}/reply`,
        { message: reply.trim() },
        { headers }
      );
      setReply('');
      toast.success('Message sent');
      await loadTicket(selectedId);
      await loadTickets();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not send reply');
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!selectedId) return;
    if (!window.confirm('Close this ticket?')) return;
    try {
      await axios.post(`${API}/support/tickets/${selectedId}/close`, {}, { headers });
      toast.success('Ticket closed');
      await loadTicket(selectedId);
      await loadTickets();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not close ticket');
    }
  };

  const closed = statusLabel(ticket?.status) === 'closed';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: 80 }}>
      <div style={{ background: 'var(--bg-page)', borderBottom: '1px solid #1e1e1e' }}>
        <div className="px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (selectedId || showNew) {
                openTicket(null);
                setShowNew(false);
              } else {
                navigate('/account');
              }
            }}
            className="p-2"
            style={{ color: '#999' }}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold flex-1" style={{ color: 'var(--text-1)' }}>
            {showNew ? 'New ticket' : selectedId ? 'Ticket' : 'Support'}
          </h1>
          {!showNew && !selectedId && (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold"
              style={{ background: ORANGE, color: '#000' }}
            >
              <Plus className="w-4 h-4" /> New
            </button>
          )}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-4">
        {showNew && (
          <form onSubmit={createTicket} className="space-y-3 mb-6">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Describe your issue. Our team is notified instantly in Telegram.
            </p>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              maxLength={120}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid #2a2a2a',
                color: 'var(--text-1)',
              }}
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="How can we help?"
              rows={6}
              maxLength={5000}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid #2a2a2a',
                color: 'var(--text-1)',
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNew(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: '#1e1e1e', color: '#aaa' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="flex-1 py-3 rounded-xl text-sm font-bold"
                style={{ background: ORANGE, color: '#000', opacity: sending ? 0.7 : 1 }}
              >
                {sending ? 'Sending…' : 'Open ticket'}
              </button>
            </div>
          </form>
        )}

        {!showNew && !selectedId && (
          <>
            {loading ? (
              <p className="text-sm py-10 text-center" style={{ color: 'var(--text-3)' }}>
                Loading…
              </p>
            ) : tickets.length === 0 ? (
              <div className="py-16 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: AMBER }} />
                <p className="font-semibold mb-1" style={{ color: 'var(--text-1)' }}>
                  No tickets yet
                </p>
                <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
                  Open a ticket and our team will reply here.
                </p>
                <button
                  type="button"
                  onClick={() => setShowNew(true)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: ORANGE, color: '#000' }}
                >
                  New ticket
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTicket(t.id)}
                    className="w-full text-left px-4 py-3 rounded-xl transition-colors"
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid #2a2a2a',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{
                          color: statusColor(t.status),
                          background: `${statusColor(t.status)}22`,
                        }}
                      >
                        {statusLabel(t.status)}
                      </span>
                      <span className="text-[10px] ml-auto" style={{ color: '#666' }}>
                        {t.id}
                      </span>
                    </div>
                    <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>
                      {t.subject}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                      Updated {t.updated_at ? new Date(t.updated_at).toLocaleString() : '—'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {!showNew && selectedId && ticket && (
          <div>
            <div
              className="px-4 py-3 rounded-xl mb-3"
              style={{ background: 'var(--bg-card)', border: '1px solid #2a2a2a' }}
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: statusColor(ticket.status),
                        background: `${statusColor(ticket.status)}22`,
                      }}
                    >
                      {statusLabel(ticket.status)}
                    </span>
                    <span className="text-[10px]" style={{ color: '#666' }}>
                      {ticket.id}
                    </span>
                  </div>
                  <h2 className="font-bold text-base" style={{ color: 'var(--text-1)' }}>
                    {ticket.subject}
                  </h2>
                </div>
                {!closed && (
                  <button
                    type="button"
                    onClick={closeTicket}
                    className="p-2 rounded-lg"
                    style={{ color: '#888', background: '#1a1a1a' }}
                    title="Close ticket"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {(ticket.messages || []).map((m) => {
                const isAdmin = m.from === 'admin';
                return (
                  <div
                    key={m.id}
                    className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className="max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm"
                      style={{
                        background: isAdmin ? 'rgba(245,166,35,0.12)' : '#1e1e1e',
                        border: isAdmin
                          ? '1px solid rgba(245,166,35,0.35)'
                          : '1px solid #2a2a2a',
                        color: 'var(--text-1)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <div
                        className="text-[10px] font-semibold mb-1 uppercase tracking-wide"
                        style={{ color: isAdmin ? AMBER : '#777' }}
                      >
                        {isAdmin ? 'Calliotel Support' : 'You'}
                      </div>
                      {m.message}
                      <div className="text-[10px] mt-1.5" style={{ color: '#666' }}>
                        {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!closed ? (
              <form onSubmit={sendReply} className="flex gap-2 items-end pb-2">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Add a follow-up…"
                  rows={2}
                  className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid #2a2a2a',
                    color: 'var(--text-1)',
                  }}
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  className="p-3 rounded-xl"
                  style={{
                    background: ORANGE,
                    color: '#000',
                    opacity: sending || !reply.trim() ? 0.5 : 1,
                  }}
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            ) : (
              <p className="text-center text-sm py-4" style={{ color: 'var(--text-3)' }}>
                This ticket is closed.
              </p>
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
};

export default SupportPage;
