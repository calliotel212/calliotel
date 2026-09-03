import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, MailOpen, Phone, Loader, Mic } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/use-toast';
import BottomNav from '../components/BottomNav';
import safeLocalStorage from '../utils/safeLocalStorage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const AMBER = '#F5A623';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const dayMs = 86400000;
  if (diff < dayMs && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 2 * dayMs) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export default function VoicemailPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const [playingId, setPlayingId] = useState(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const r = await axios.get(`${API}/calls/voicemails`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(r.data.voicemails || []);
      setUnread(r.data.unread || 0);
    } catch {
      toast({ title: 'Could not load voicemail', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/calls/voicemails/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => prev.map((v) => (v.id === id ? { ...v, read: true } : v)));
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* ignore */ }
  };

  const remove = async (id) => {
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.delete(`${API}/calls/voicemails/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => prev.filter((v) => v.id !== id));
      toast({ title: 'Voicemail deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-page)', paddingBottom: 72 }}>
      <div style={{ borderBottom: '1px solid #1e1e1e', padding: '12px 16px' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 4 }}
          >
            <ArrowLeft size={22} />
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>Voicemail</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
              {unread > 0 ? `${unread} unread` : 'Messages & transcripts'}
            </p>
          </div>
          <Mic size={20} color={AMBER} />
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#666' }}>
            <Loader className="animate-spin" style={{ margin: '0 auto' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#666' }}>
            <Mic size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 700, color: '#999', marginBottom: 6 }}>No voicemails yet</p>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
              Missed calls go here. If you set a real phone, it rings first — if you do not pick up, the caller can leave a message.
            </p>
          </div>
        ) : (
          items.map((vm) => (
            <div
              key={vm.id}
              style={{
                padding: '14px 16px',
                borderBottom: '1px solid #1a1a1a',
                background: vm.read ? 'transparent' : 'rgba(245,166,35,0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, color: 'var(--text-1)', fontSize: 14 }}>
                      {vm.from_number || 'Unknown'}
                    </span>
                    {!vm.read && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: AMBER, background: 'rgba(245,166,35,0.15)', padding: '2px 6px', borderRadius: 999 }}>
                        NEW
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#666', marginLeft: 'auto' }}>
                      {formatDate(vm.created_at)}
                    </span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: '#555' }}>
                    to {vm.to_number || 'your number'}
                    {vm.duration_secs ? ` · ${vm.duration_secs}s` : ''}
                  </p>

                  {vm.audio_url && (
                    <audio
                      controls
                      src={vm.audio_url}
                      preload="none"
                      onPlay={() => {
                        setPlayingId(vm.id);
                        if (!vm.read) markRead(vm.id);
                      }}
                      style={{ width: '100%', marginTop: 10, height: 36 }}
                    />
                  )}

                  <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'var(--soft-fill-2)', border: '1px solid #222' }}>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: '#666', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Transcript
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: vm.transcript ? '#ccc' : '#555', lineHeight: 1.45 }}>
                      {vm.transcript
                        || (vm.transcript_status === 'pending' ? 'Transcribing…' : 'No transcript available')}
                    </p>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => vm.from_number && navigate(`/keypad?number=${encodeURIComponent(vm.from_number)}`)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'rgba(245,166,35,0.12)', color: AMBER, fontWeight: 700, fontSize: 12,
                  }}
                >
                  <Phone size={14} /> Call back
                </button>
                {!vm.read && (
                  <button
                    type="button"
                    onClick={() => markRead(vm.id)}
                    style={{
                      padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'var(--bg-card)', color: '#888',
                    }}
                    title="Mark read"
                  >
                    <MailOpen size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(vm.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: 'var(--bg-card)', color: '#666',
                  }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
