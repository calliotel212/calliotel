import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trash2, MailOpen, Phone, Loader, Disc } from 'lucide-react';
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

const formatDuration = (seconds) => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
};

export default function RecordingsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const token = safeLocalStorage.getItem('token');
      const r = await axios.get(`${API}/calls/recordings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(r.data.recordings || []);
      setUnread(r.data.unread || 0);
    } catch {
      toast({ title: 'Could not load recordings', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.post(`${API}/calls/recordings/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => prev.map((v) => (v.id === id ? { ...v, read: true } : v)));
      setUnread((u) => Math.max(0, u - 1));
    } catch { /* ignore */ }
  };

  const remove = async (id) => {
    try {
      const token = safeLocalStorage.getItem('token');
      await axios.delete(`${API}/calls/recordings/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems((prev) => prev.filter((v) => v.id !== id));
      toast({ title: 'Recording deleted' });
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
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: 'var(--text-1)' }}>Call recordings</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
              {unread > 0 ? `${unread} new` : 'Via-phone & forwarded calls'}
            </p>
          </div>
          <Disc size={20} color={AMBER} />
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 16px 0' }}>
        <p style={{ margin: 0, fontSize: 12, color: '#555', lineHeight: 1.45 }}>
          Calls placed via phone callback and answered inbound forwards are recorded automatically.
          Tell the other party if your local laws require consent.
        </p>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '12px 0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#666' }}>
            <Loader className="animate-spin" style={{ margin: '0 auto' }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: '#666' }}>
            <Disc size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontWeight: 700, color: '#999', marginBottom: 6 }}>No recordings yet</p>
            <p style={{ fontSize: 13, lineHeight: 1.5 }}>
              Place a call from the keypad in Via phone mode, or answer an inbound call on your forwarded phone — the recording appears here when the call ends.
            </p>
          </div>
        ) : (
          items.map((rec) => {
            const outbound = (rec.direction || 'outbound') === 'outbound';
            const peer = outbound ? rec.to_number : rec.from_number;
            const dialBack = peer;
            return (
              <div
                key={rec.id}
                style={{
                  padding: '14px 16px',
                  borderBottom: '1px solid #1a1a1a',
                  background: rec.read ? 'transparent' : 'rgba(245,166,35,0.06)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text-1)', fontSize: 14 }}>
                        {peer || 'Unknown'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: '#888',
                        background: 'var(--bg-card)', padding: '2px 6px', borderRadius: 999,
                      }}>
                        {outbound ? 'OUT' : 'IN'}
                      </span>
                      {!rec.read && (
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: AMBER,
                          background: 'rgba(245,166,35,0.15)', padding: '2px 6px', borderRadius: 999,
                        }}>
                          NEW
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: '#666', marginLeft: 'auto' }}>
                        {formatDate(rec.created_at)}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 11, color: '#555' }}>
                      {outbound ? `from ${rec.from_number || 'your number'}` : `to ${rec.to_number || 'your number'}`}
                      {rec.duration_secs ? ` · ${formatDuration(rec.duration_secs)}` : ''}
                    </p>

                    {rec.audio_url && (
                      <audio
                        controls
                        src={rec.audio_url}
                        preload="none"
                        onPlay={() => {
                          if (!rec.read) markRead(rec.id);
                        }}
                        style={{ width: '100%', marginTop: 10, height: 36 }}
                      />
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => dialBack && navigate(`/keypad?number=${encodeURIComponent(dialBack)}`)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      background: 'rgba(245,166,35,0.12)', color: AMBER, fontWeight: 700, fontSize: 12,
                    }}
                  >
                    <Phone size={14} /> Call back
                  </button>
                  {!rec.read && (
                    <button
                      type="button"
                      onClick={() => markRead(rec.id)}
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
                    onClick={() => remove(rec.id)}
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
            );
          })
        )}
      </div>

      <BottomNav />
    </div>
  );
}
