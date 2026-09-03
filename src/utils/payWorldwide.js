/** First $5 that succeeds where Calliotel actually gets traffic. */

export const CARD_MAX = 50;
export const CARD_MIN = 2;
export const CARD_PACKAGES = [2, 3, 5, 6, 7, 8, 10, 20, 50];
export const CARD_ACCOUNT_AGE_HOURS = 0;
export const FIRST_FIVE = 5;
/** NOWPayments live floor is ~$12. $5 TRX is rejected by the provider. */
export const CRYPTO_FLOOR = 12;
/** Same as NOWPayments — Bekena $5 checkout is off. */
export const USDT_FLOOR = 12;

/** Stripe / local cards usually work here. Everywhere else, lead with crypto. */
export const CARD_OK_COUNTRIES = new Set([
  'US', 'CA', 'GB', 'IE', 'AU', 'NZ',
  'DE', 'FR', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'FI',
  'IT', 'ES', 'PT', 'LU', 'IS', 'LI', 'PL', 'CZ',
  'JP', 'KR', 'SG', 'HK', 'TW', 'IL',
]);

/**
 * Card is capped, 3DS-blocked, or routinely declined.
 * Includes the corridors that already send Calliotel traffic.
 */
export const CRYPTO_FIRST_COUNTRIES = new Set([
  'RU', 'IR', 'CU', 'KP', 'SY', 'SD', 'VE',
  'NG', 'GH', 'KE', 'TZ', 'UG', 'SN', 'CI', 'CM', 'ET', 'ZW', 'ZM', 'MZ', 'RW', 'BJ', 'ML', 'BF', 'ZA',
  'PK', 'BD', 'LK', 'NP', 'MM', 'IN',
  'VN', 'ID', 'PH', 'KH', 'LA', 'MN',
  'UZ', 'KZ', 'TJ', 'TM', 'KG', 'BY', 'MD', 'AM', 'GE', 'AZ', 'UA',
  'EG', 'DZ', 'MA', 'TN', 'LY', 'IQ', 'AF', 'YE', 'LB', 'JO', 'PS',
  'SA', 'QA', 'KW', 'OM', 'BH', 'TR',
  'CN', 'AR', 'BR', 'MX', 'CO', 'PE', 'CL', 'EC', 'BO', 'PY', 'UY', 'GT', 'HN', 'SV', 'DO',
]);

/** Fincra NGN checkout — Nigeria cards, bank transfer, USSD. */
export const FINCRA_COUNTRIES = new Set(['NG']);

export const PREVIEW_COUNTRIES = [
  { code: 'LB', label: 'Lebanon' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'IN', label: 'India' },
  { code: 'US', label: 'United States' },
  { code: 'DE', label: 'Germany' },
];

const COUNTRY_NAMES = {
  LB: 'Lebanon', NG: 'Nigeria', GH: 'Ghana', KE: 'Kenya', IN: 'India',
  PK: 'Pakistan', BD: 'Bangladesh', EG: 'Egypt', MA: 'Morocco', TR: 'Turkey',
  UA: 'Ukraine', RU: 'Russia', BR: 'Brazil', MX: 'Mexico', AR: 'Argentina',
  PH: 'Philippines', ID: 'Indonesia', VN: 'Vietnam', CN: 'China', ZA: 'South Africa',
  US: 'United States', CA: 'Canada', GB: 'United Kingdom', DE: 'Germany',
  FR: 'France', AU: 'Australia', AE: 'UAE', SA: 'Saudi Arabia', AM: 'Armenia',
};

export function countryLabel(code) {
  if (!code) return '';
  return COUNTRY_NAMES[code] || code;
}

export function isLocalPayPreview() {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export function accountAgeHours(createdAt) {
  if (!createdAt) return null;
  const ts = new Date(createdAt);
  if (Number.isNaN(ts.getTime())) return null;
  return (Date.now() - ts.getTime()) / 3600000;
}

export function accountTooNewForCard(createdAt) {
  const hours = accountAgeHours(createdAt);
  if (hours == null) return false;
  return hours < CARD_ACCOUNT_AGE_HOURS;
}

export function isCryptoFirstCountry(code) {
  if (!code) return true;
  if (CARD_OK_COUNTRIES.has(code)) return false;
  return CRYPTO_FIRST_COUNTRIES.has(code) || !CARD_OK_COUNTRIES.has(code);
}

/**
 * One method that should actually collect the first $5.
 * Unknown country → crypto (worldwide). New account → crypto (Stripe 24h lock).
 */
export function preferredPayMethod({ country, createdAt, amount, fincraEnabled } = {}) {
  const amt = Number(amount) || 0;
  if (amt > CARD_MAX) return 'crypto';
  if (fincraEnabled && FINCRA_COUNTRIES.has(country) && amt >= CARD_MIN) return 'fincra';
  if (accountTooNewForCard(createdAt)) return 'crypto';
  return 'card';
}

export function suggestedCardAmount(needed) {
  const need = Math.max(CARD_MIN, Math.ceil(Number(needed) || CARD_MIN));
  const match = CARD_PACKAGES.find((p) => p >= need);
  return match || CARD_MAX;
}

export function cryptoPayAmount(needed, floor = CRYPTO_FLOOR) {
  const need = Math.max(Number(needed) || 0, 0);
  return Math.max(floor, Math.ceil(need) || floor);
}

export function payReason({ country, createdAt, amount, fincraEnabled } = {}) {
  const amt = Number(amount) || 0;
  const method = preferredPayMethod({ country, createdAt, amount, fincraEnabled });
  const place = countryLabel(country);
  const cryptoAmt = amt >= CRYPTO_FLOOR ? amt : CRYPTO_FLOOR;
  if (amt > CARD_MAX) {
    return {
      method,
      title: `Card max is $${CARD_MAX}`,
      body: `Pay $${amt || cryptoAmt} with USDT TRC-20. Same wallet as card.`,
    };
  }
  if (method === 'fincra') {
    return {
      method,
      title: amt ? `Pay $${amt} with Naira` : 'Pay $2 with Naira',
      body: 'Nigerian cards, bank transfer, and USSD. Same Calliotel wallet as Stripe.',
    };
  }
  if (accountTooNewForCard(createdAt)) {
    return {
      method,
      title: 'Card unlocks after 24 hours',
      body: `Stripe blocks cards on new accounts. Pay $${Math.max(USDT_FLOOR, amt || USDT_FLOOR)} with USDT now — same wallet, number goes live.`,
    };
  }
  if (method === 'crypto') {
    return {
      method,
      title: place ? `In ${place}, card often fails` : 'Card fails in many countries',
      body: `Pay $${Math.max(USDT_FLOOR, amt || USDT_FLOOR)} with USDT on Tron. Same wallet, enough for the number.`,
    };
  }
  return {
    method,
    title: amt ? `Pay $${amt} with card` : 'Pay $2 with card',
    body: `Visa, Mastercard, Apple Pay, Google Pay, Link, and local methods. $2–$50. USDT from $${USDT_FLOOR} if the bank declines.`,
  };
}
