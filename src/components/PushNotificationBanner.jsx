import React, { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import pushNotificationManager from '../utils/pushNotificationManager';
import { isTelegramMiniApp } from '../utils/telegramMiniApp';
import { useLocation } from 'react-router-dom';

const DISMISSED_KEY = 'push_banner_dismissed_until';

const PushNotificationBanner = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [show, setShow]         = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;

    // Feature must be supported
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    let cancelled = false;

    const maybeShow = async () => {
      // Do not interrupt signup, payment, or carrier activation. Route changes
      // after activation cause this effect to run again on the welcome screen.
      if (safeGet('pendingNumberPurchase')) return;

      // Permanently denied → nothing to ask
      if (Notification.permission === 'denied') return;

      // Dismissed recently → wait (unless never subscribed while granted)
      const until = safeGet(DISMISSED_KEY);
      const dismissed = until && Date.now() < parseInt(until);

      if (Notification.permission === 'granted') {
        try {
          await pushNotificationManager.initialize();
          const subscribed = await pushNotificationManager.isSubscribed();
          if (!subscribed) {
            // Permission ok but no SW subscription (common after SW was killed) — re-subscribe silently
            await pushNotificationManager.subscribe().catch(() => {});
          }
        } catch {}
        return;
      }

      if (Notification.permission !== 'default') return;
      if (dismissed) return;

      // Show after 2.5 s so it doesn't pop up on top of the login animation
      setTimeout(() => { if (!cancelled) setShow(true); }, 2500);
    };

    maybeShow();
    return () => { cancelled = true; };
  }, [isAuthenticated, location.pathname, location.search]);

  const handleEnable = async () => {
    setRequesting(true);
    setError('');
    try {
      const result = await pushNotificationManager.requestPermission();
      if (result?.success) {
        setShow(false);
      } else {
        setError('Notifications were not enabled. Allow them in your browser settings and try again.');
      }
    } catch {
      setError('Could not enable notifications. Please try again from Push Alerts in the menu.');
    } finally {
      setRequesting(false);
    }
  };

  const handleDismiss = () => {
    // Snooze for 7 days
    safeSet(DISMISSED_KEY, String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    setShow(false);
  };

  if (!show) return null;
  if (isTelegramMiniApp()) return null;

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-50 max-w-sm mx-auto"
      style={{ animation: 'slideUp 0.3s ease' }}
    >
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 border border-gray-700">
        <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Bell className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Get SMS &amp; call alerts</p>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            Know instantly when someone texts or calls your number — even when the app is closed.
          </p>
          {error && <p className="text-xs text-red-400 mt-2 leading-relaxed">{error}</p>}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleEnable}
              disabled={requesting}
              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {requesting ? 'Enabling…' : '🔔 Enable'}
            </button>
            <button onClick={handleDismiss} className="px-3 py-1.5 text-gray-400 hover:text-white text-sm transition-colors">
              Not now
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-gray-600 hover:text-white flex-shrink-0 p-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const safeGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const safeSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

export default PushNotificationBanner;
