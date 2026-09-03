import safeLocalStorage from './safeLocalStorage';

const AUTH_REDIRECT_KEY = 'auth_redirect';
const PENDING_KEY = 'pendingNumberPurchase';

/** Only allow same-origin relative paths (block open redirects). */
export function sanitizeNextPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const next = raw.trim();
  if (!next.startsWith('/')) return null;
  if (next.startsWith('//')) return null;
  if (next.includes('://')) return null;
  if (next.startsWith('/login') || next.startsWith('/signup')) return null;
  return next;
}

export function setAuthRedirect(path) {
  const safe = sanitizeNextPath(path);
  if (safe) safeLocalStorage.setItem(AUTH_REDIRECT_KEY, safe);
}

export function captureNextFromSearchParams(searchParams) {
  if (!searchParams) return null;
  const next = sanitizeNextPath(searchParams.get('next'));
  if (next) {
    safeLocalStorage.setItem(AUTH_REDIRECT_KEY, next);
    return next;
  }
  return null;
}

export function peekPendingNumberPurchase() {
  try {
    const raw = safeLocalStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

/**
 * Where to send the user after signup/login/Google/Telegram.
 * Priority: pending number → saved ?next=/auth_redirect → onboarding (new) → account.
 */
export function resolvePostAuthRoute({ isNewUser = false } = {}) {
  const pending = peekPendingNumberPurchase();
  if (pending) {
    // One door: activate if funded, otherwise pay once — never generic onboarding.
    return '/first-hour';
  }

  const saved = sanitizeNextPath(safeLocalStorage.getItem(AUTH_REDIRECT_KEY));
  if (saved) {
    safeLocalStorage.removeItem(AUTH_REDIRECT_KEY);
    return saved;
  }

  if (isNewUser) return '/browse-numbers?first=1';
  return '/account';
}

export function savePendingNumberPurchase(pending) {
  if (!pending || typeof pending !== 'object') return;
  safeLocalStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function clearPendingNumberPurchase() {
  safeLocalStorage.removeItem(PENDING_KEY);
}
