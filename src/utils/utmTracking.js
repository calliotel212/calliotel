const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const CLICK_ID_KEYS = ['gclid', 'gbraid', 'wbraid'];
const ATTRIBUTION_KEYS = [...UTM_KEYS, ...CLICK_ID_KEYS, 'landing_page', 'referrer'];
const STORAGE_KEY = 'calliotel_attribution';
const STORAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const safeLocalStorage = {
  getItem: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: (k) => { try { localStorage.removeItem(k); } catch {} },
};

function sanitizeUrl(rawUrl) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

export function captureAttribution() {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    const incoming = {};
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) incoming[k] = String(v).slice(0, 200);
    });
    CLICK_ID_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) incoming[k] = String(v).slice(0, 200);
    });
    // Google auto-tagging sends gclid, not utm_source. Without this, Search ads
    // look like "(none)" and Smart Bidding cannot learn who paid.
    if ((incoming.gclid || incoming.gbraid || incoming.wbraid) && !incoming.utm_source) {
      incoming.utm_source = 'google';
      incoming.utm_medium = incoming.utm_medium || 'cpc';
    }

    const existing = readStored();

    if (Object.keys(incoming).length > 0) {
      const data = {
        ...incoming,
        landing_page: sanitizeUrl(window.location.href),
        referrer: sanitizeUrl(document.referrer),
        captured_at: Date.now(),
      };
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }

    if (!existing) {
      const data = {
        landing_page: sanitizeUrl(window.location.href),
        referrer: sanitizeUrl(document.referrer),
        captured_at: Date.now(),
      };
      safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }

    return existing;
  } catch {
    return null;
  }
}

function readStored() {
  const raw = safeLocalStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.captured_at || Date.now() - parsed.captured_at > STORAGE_TTL_MS) {
      safeLocalStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    safeLocalStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function getAttribution() {
  const stored = readStored();
  if (!stored) return {};
  const out = {};
  for (const key of ATTRIBUTION_KEYS) {
    if (stored[key]) out[key] = stored[key];
  }
  return out;
}
