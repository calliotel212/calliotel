/** Late Summer Talk — live campaign through 21 Sep 2026. */

export const TALK_OFFER = {
  id: 'late_summer_talk_2026',
  name: 'Late Summer Talk',
  headline: 'Real calls, not OTP',
  offerLine: 'First $5 unlocks 60 minutes to the US & Canada. Then $0.02/min.',
  endsAt: '2026-09-21T23:59:59.000Z',
  endsLabel: 'Ends Sep 21st',
  minutes: 60,
  bonusUsd: 1.2,
  minDeposit: 5,
  usCaRate: 0.02,
  numberFrom: 1.99,
  ctaPath: '/buy-credits?amount=5&offer=talk',
  dismissKey: 'calliotel_talk_offer_dismiss_v1',
};

export const TALK_DESTINATIONS = [
  { flag: '🇺🇸', name: 'United States', rate: '$0.02', unit: '/min', note: 'Campaign rate' },
  { flag: '🇨🇦', name: 'Canada', rate: '$0.02', unit: '/min', note: 'Campaign rate' },
  { flag: '🇮🇳', name: 'India', rate: '$0.05', unit: '/min', note: 'Pay as you go' },
  { flag: '🇬🇧', name: 'United Kingdom', rate: '$0.05', unit: '/min', note: 'Pay as you go' },
  { flag: '🇩🇪', name: 'Germany', rate: '$0.05', unit: '/min', note: 'Pay as you go' },
  { flag: '🇵🇰', name: 'Pakistan', rate: '$0.10', unit: '/min', note: 'Pay as you go' },
];

export function isTalkOfferLive(now = Date.now()) {
  return now < Date.parse(TALK_OFFER.endsAt);
}

export function talkOfferRemaining(now = Date.now()) {
  const ms = Math.max(0, Date.parse(TALK_OFFER.endsAt) - now);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return { ms, days, hours, mins, expired: ms <= 0 };
}

export function wasTalkOfferDismissed() {
  try {
    return localStorage.getItem(TALK_OFFER.dismissKey) === '1';
  } catch {
    return false;
  }
}

export function dismissTalkOffer() {
  try {
    localStorage.setItem(TALK_OFFER.dismissKey, '1');
  } catch { /* ignore */ }
}
