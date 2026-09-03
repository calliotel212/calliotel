/**
 * Google Ads + GA4 Conversion Tracking — Calliotel
 *
 * Google Ads account: AW-824204080
 * GA4 property:       G-TYHH3Q9QZE
 *
 * HOW TO GET YOUR CONVERSION LABELS:
 *   1. Go to Google Ads → Tools → Conversions
 *   2. Create a new "Conversion action" (Website)
 *   3. Choose "Manual tag" — copy the label that looks like: "AbCdEfGhIjK12345"
 *   4. Replace the SIGNUP_LABEL and PURCHASE_LABEL constants below
 *
 * GOOGLE ADS STRATEGY (recommended conversion actions to create):
 *   • "Sign Up"       — fires when user completes registration
 *   • "Purchase"      — fires when payment is confirmed
 *   • "Number Activated" — fires when user activates their first virtual number
 */

const ADS_ID = 'AW-824204080';

// ── Replace these with your real conversion labels from Google Ads UI ──
export const CONVERSION_LABELS = {
  SIGNUP:        'ZenHCM_4ouUcELC2gYkD',          // ✅ Calliotel Signup (1) — new Calliotel action (not Mixlogins)
  PURCHASE:      'vw-5CPTA0J0cELC2gYkD',          // ✅ Calliotel Purchase — fires on number purchase
  WALLET_TOPUP:  '0g8gCLyZ5p0cELC2gYkD',          // ✅ Calliotel Wallet Topup — fires on Stripe/USDT deposit
  NUMBER_ACTIVATED: 'REPLACE_WITH_NUMBER_ACTIVATED_LABEL',
};

/* ── Helper: safe gtag call ───────────────────────────────────── */
const safeGtag = (...args) => {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag(...args);
  }
};

/** Raw email for Enhanced conversions. gtag hashes it. Never pre-hash. */
function conversionEmail(explicit) {
  const fromArg = String(explicit || '').trim().toLowerCase();
  if (fromArg && fromArg.includes('@')) return fromArg;
  try {
    const raw = window.localStorage.getItem('calliotel_user_cache');
    const u = raw ? JSON.parse(raw) : null;
    const cached = String(u?.email || '').trim().toLowerCase();
    if (cached && cached.includes('@')) return cached;
  } catch { /* ignore */ }
  return '';
}

function withUserData(payload, email) {
  const em = conversionEmail(email);
  if (!em) return payload;
  safeGtag('set', 'user_data', { email: em });
  return { ...payload, user_data: { email: em } };
}

/* ── Helper: safe TikTok ttq call ─────────────────────────────── */
const safeTtq = (method, ...args) => {
  try {
    if (typeof window !== 'undefined' && window.ttq && typeof window.ttq[method] === 'function') {
      window.ttq[method](...args);
    }
  } catch (e) {
    /* swallow — never let analytics break the app */
  }
};

/* ── Conversion: User signed up ───────────────────────────────── */
export const trackSignup = ({ email } = {}) => {
  // GA4 sign_up event — importable into Google Ads as a Goal
  safeGtag('event', 'sign_up', {
    method: 'email',
    event_category: 'engagement',
    event_label: 'Calliotel Signup',
  });

  // Google Ads conversion event (fires only when label is set)
  if (!CONVERSION_LABELS.SIGNUP.startsWith('REPLACE')) {
    safeGtag('event', 'conversion', withUserData({
      send_to: `${ADS_ID}/${CONVERSION_LABELS.SIGNUP}`,
      value: 1.0,
      currency: 'USD',
    }, email));
  }

  // TikTok — CompleteRegistration (standard event, contents[] format per TikTok spec)
  safeTtq('track', 'CompleteRegistration', {
    contents: [{
      content_id: 'calliotel_signup',
      content_type: 'product',
      content_name: 'Calliotel Account Signup',
    }],
    value: 1.0,
    currency: 'USD',
  });
};

/* ── Conversion: Payment completed ───────────────────────────── */
export const trackPurchase = ({ value = 0, currency = 'USD', transactionId = '', email } = {}) => {
  // GA4 purchase event — rich ecommerce signal
  safeGtag('event', 'purchase', {
    transaction_id: transactionId,
    value,
    currency,
    event_category: 'ecommerce',
    event_label: 'Virtual Number Purchase',
  });

  // Google Ads conversion event
  if (!CONVERSION_LABELS.PURCHASE.startsWith('REPLACE')) {
    safeGtag('event', 'conversion', withUserData({
      send_to: `${ADS_ID}/${CONVERSION_LABELS.PURCHASE}`,
      value,
      currency,
      transaction_id: transactionId,
    }, email));
  }

  // TikTok — Purchase (standard event, contents[] format per TikTok spec)
  safeTtq('track', 'Purchase', {
    contents: [{
      content_id: transactionId || 'virtual_number',
      content_type: 'product',
      content_name: 'Virtual Number Purchase',
    }],
    value,
    currency,
  });
};

/* ── Conversion: Wallet top-up (Stripe) ─────────────────────── */
export const trackWalletTopup = ({ value = 0, currency = 'USD', method = 'stripe', transactionId = '', email } = {}) => {
  // GA4 add_payment_info — useful for funnel analysis
  safeGtag('event', 'add_payment_info', {
    value,
    currency,
    payment_type: method,
    event_category: 'ecommerce',
    event_label: `Wallet Topup (${method})`,
  });

  // Google Ads conversion event
  if (!CONVERSION_LABELS.WALLET_TOPUP.startsWith('REPLACE')) {
    safeGtag('event', 'conversion', withUserData({
      send_to: `${ADS_ID}/${CONVERSION_LABELS.WALLET_TOPUP}`,
      value,
      currency,
      transaction_id: transactionId,
    }, email));
  }

  // TikTok — AddPaymentInfo (standard event, contents[] format per TikTok spec)
  safeTtq('track', 'AddPaymentInfo', {
    contents: [{
      content_id: transactionId || `wallet_${method}`,
      content_type: 'product',
      content_name: `Wallet Topup (${method})`,
    }],
    value,
    currency,
  });
};

/* ── Conversion: Number activated ────────────────────────────── */
export const trackNumberActivated = () => {
  safeGtag('event', 'number_activated', {
    event_category: 'telecom',
    event_label: 'Virtual Number Activated',
  });

  if (!CONVERSION_LABELS.NUMBER_ACTIVATED.startsWith('REPLACE')) {
    safeGtag('event', 'conversion', {
      send_to: `${ADS_ID}/${CONVERSION_LABELS.NUMBER_ACTIVATED}`,
      value: 2.0,
      currency: 'USD',
    });
  }
};

/* ── Page view (called automatically via gtag config) ─────────── */
export const trackPageView = (path) => {
  safeGtag('event', 'page_view', {
    page_path: path,
    page_location: window.location.href,
  });
};
