export const TELEGRAM_MINI_APP_URL = 'https://t.me/Calliotelbot/app';
export const TELEGRAM_MINI_APP_SERVICES_URL = 'https://t.me/Calliotelbot/app?startapp=services';

const SERVICES_START = new Set(['services', 'shop', 'service']);

export function getMiniAppStartParam() {
  const tg = getTelegramWebApp();
  const fromTg = String(tg?.initDataUnsafe?.start_param || '').trim().toLowerCase();
  if (fromTg) return fromTg;
  if (typeof window === 'undefined') return '';
  try {
    const hash = String(window.location.hash || '');
    const q = new URLSearchParams(hash.replace(/^#/, ''));
    return String(q.get('tgWebAppStartParam') || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

export function isMiniAppServicesStart() {
  return SERVICES_START.has(getMiniAppStartParam());
}

export function getTelegramWebApp() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp || null;
}

export function isTelegramMiniApp() {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  return !!(tg.initData || tg.initDataUnsafe?.user);
}

export function haptic(kind = 'success') {
  const h = getTelegramWebApp()?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === 'impact') h.impactOccurred('medium');
    else h.notificationOccurred(kind);
  } catch {
    /* older Telegram clients */
  }
}

export function bootTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return false;
  try {
    tg.ready();
    if (typeof tg.expand === 'function') tg.expand();
    if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#0d0d0d');
    if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#0d0d0d');
    const root = document.documentElement;
    const applySafeArea = () => {
      const sa = tg.safeAreaInset || {};
      const csa = tg.contentSafeAreaInset || {};
      const top = Number(sa.top || 0) + Number(csa.top || 0);
      const bottom = Number(sa.bottom || 0) + Number(csa.bottom || 0);
      root.style.setProperty('--tg-safe-area-inset-top', `${top}px`);
      root.style.setProperty('--tg-safe-area-inset-bottom', `${bottom}px`);
    };
    applySafeArea();
    if (typeof tg.onEvent === 'function') {
      tg.onEvent('safeAreaChanged', applySafeArea);
      tg.onEvent('contentSafeAreaChanged', applySafeArea);
      tg.onEvent('viewportChanged', applySafeArea);
    }
    root.classList.add('tg-miniapp');
    document.body.style.background = '#0d0d0d';
    return true;
  } catch {
    return false;
  }
}
