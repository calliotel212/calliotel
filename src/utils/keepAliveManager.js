/**
 * KeepAlive — prevent the Calliotel web session from going idle while the
 * user is logged in. Browsers will still suspend background tabs eventually;
 * this maximizes foreground/PWA uptime and keeps push subscription alive so
 * SMS alerts arrive even when the page is not focused.
 */

import pushNotificationManager from './pushNotificationManager';
import safeLocalStorage from './safeLocalStorage';

const HEARTBEAT_MS = 45 * 1000;
const PUSH_REFRESH_MS = 6 * 60 * 60 * 1000; // re-check subscription every 6h

class KeepAliveManager {
  constructor() {
    this.wakeLock = null;
    this.heartbeatTimer = null;
    this.pushTimer = null;
    this.active = false;
    this._onVis = this._onVis.bind(this);
    this._onFocus = this._onFocus.bind(this);
  }

  start() {
    if (this.active) return;
    this.active = true;

    document.addEventListener('visibilitychange', this._onVis);
    window.addEventListener('focus', this._onFocus);
    window.addEventListener('pageshow', this._onFocus);

    this._acquireWakeLock();
    this._ensurePush();
    this._startHeartbeat();

    this.pushTimer = setInterval(() => this._ensurePush(), PUSH_REFRESH_MS);
  }

  stop() {
    this.active = false;
    document.removeEventListener('visibilitychange', this._onVis);
    window.removeEventListener('focus', this._onFocus);
    window.removeEventListener('pageshow', this._onFocus);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pushTimer) clearInterval(this.pushTimer);
    this.heartbeatTimer = null;
    this.pushTimer = null;
    this._releaseWakeLock();
  }

  _onVis() {
    if (document.hidden) {
      // Tab backgrounded — JS may sleep; wake lock is released by browser.
      // Push SW must carry alerts from here.
      this._ensurePush();
    } else {
      this._acquireWakeLock();
      this._ensurePush();
    }
  }

  _onFocus() {
    this._acquireWakeLock();
  }

  async _acquireWakeLock() {
    if (!('wakeLock' in navigator)) return;
    if (document.hidden) return;
    try {
      // Screen wake lock keeps the device awake while Calliotel is visible
      // (critical for PWA / "installed app" usage).
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
      console.log('✅ KeepAlive: screen wake lock acquired');
    } catch (err) {
      // NotAllowedError if no user gesture yet — retry on next interaction
      console.debug('KeepAlive wake lock deferred:', err?.name || err);
    }
  }

  async _releaseWakeLock() {
    try {
      await this.wakeLock?.release();
    } catch {}
    this.wakeLock = null;
  }

  _startHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      // Cheap keepalive tick — also re-acquires wake lock if browser released it
      if (!document.hidden) this._acquireWakeLock();
      try {
        // Touch local storage + SW so browsers treat the PWA as active
        safeLocalStorage.setItem('calliotel_keepalive_ts', String(Date.now()));
      } catch {}
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          try { reg.active?.postMessage({ type: 'KEEPALIVE', ts: Date.now() }); } catch {}
        }).catch(() => {});
      }
    }, HEARTBEAT_MS);
  }

  async _ensurePush() {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const ok = await pushNotificationManager.initialize();
      if (!ok) return;
      const subscribed = await pushNotificationManager.isSubscribed();
      if (!subscribed) {
        await pushNotificationManager.subscribe();
      }
    } catch (err) {
      console.debug('KeepAlive push ensure failed:', err?.message || err);
    }
  }
}

const keepAliveManager = new KeepAliveManager();
export default keepAliveManager;
