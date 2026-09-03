import { useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/use-toast';
import safeLocalStorage from '../utils/safeLocalStorage';
import notificationSoundManager from '../utils/notificationSoundManager';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const SEEN_KEY = 'sms_alert_seen_ids';
const POLL_MS = 8000;

function loadSeen() {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveSeen(set) {
  try {
    // Keep last 200 ids so sessionStorage stays small
    sessionStorage.setItem(SEEN_KEY, JSON.stringify([...set].slice(-200)));
  } catch {}
}

function msgId(m) {
  return String(m.id || m._id || `${m.from_number}|${m.to_number}|${m.created_at}|${m.text || ''}`);
}

/**
 * Polls inbox for authenticated users and fires sound + toast + browser popup
 * when new inbound SMS arrives. Also listens for service-worker push messages.
 */
const SmsAlertWatcher = () => {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const seenRef = useRef(null);
  const primedRef = useRef(false);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (!isAuthenticated) return;

    seenRef.current = loadSeen();
    primedRef.current = seenRef.current.size > 0;

    const alertNew = async (items) => {
      if (!items.length) return;

      try {
        await notificationSoundManager.initialize();
        await notificationSoundManager.playSmsReceived();
      } catch {}

      const first = items[0];
      const from = first.from_number || 'Unknown';
      const preview = (first.text || first.body || '').slice(0, 80);
      const title = `📩 New SMS from ${from}`;
      const body = preview || '(no text)';

      toastRef.current?.({ title, description: body });

      // Browser popup when permission already granted (works with tab open/background)
      try {
        if ('Notification' in window && Notification.permission === 'granted') {
          const n = new Notification(title, {
            body,
            icon: '/logo192.png',
            tag: `sms-${msgId(first)}`,
            data: { url: '/sms' },
          });
          n.onclick = () => {
            try { window.focus(); window.location.href = '/sms'; } catch {}
            n.close();
          };
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('sms:new', { detail: { messages: items } }));
    };

    const poll = async () => {
      try {
        const token = safeLocalStorage.getItem('token');
        if (!token) return;
        const res = await axios.get(`${API}/sms/inbox`, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 12000,
        });
        const messages = res.data?.messages || [];
        const inbound = messages.filter((m) => m.direction === 'inbound');
        const seen = seenRef.current || new Set();

        if (!primedRef.current) {
          // First successful poll: seed seen set, don't alarm on history
          inbound.forEach((m) => seen.add(msgId(m)));
          seenRef.current = seen;
          saveSeen(seen);
          primedRef.current = true;
          return;
        }

        const fresh = inbound.filter((m) => !seen.has(msgId(m)));
        if (fresh.length) {
          fresh.forEach((m) => seen.add(msgId(m)));
          seenRef.current = seen;
          saveSeen(seen);
          await alertNew(fresh);
        }
      } catch {
        // ignore transient network errors
      }
    };

    poll();
    const iv = setInterval(poll, POLL_MS);

    const onVis = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVis);

    const onPushMsg = (event) => {
      const data = event.data;
      if (!data || data.type !== 'CALLIOTEL_PUSH') return;
      // Sound + toast for push while tab is open (popup already shown by SW)
      (async () => {
        try {
          await notificationSoundManager.initialize();
          await notificationSoundManager.playSmsReceived();
        } catch {}
        toastRef.current?.({
          title: data.title || '📩 New SMS',
          description: data.body || '',
        });
        window.dispatchEvent(new CustomEvent('sms:new', { detail: { push: data } }));
      })();
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', onPushMsg);
    }

    // Unlock audio on first user gesture (browser autoplay policy)
    const unlock = () => {
      notificationSoundManager.initialize().catch(() => {});
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', onPushMsg);
      }
    };
  }, [isAuthenticated]);

  return null;
};

export default SmsAlertWatcher;
