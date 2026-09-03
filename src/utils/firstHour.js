import { peekPendingNumberPurchase } from './authRedirect';

/** After a number is live, first sitting ends on SMS — not My Numbers or Wallet. */
export function pathAfterNumberLive(phoneNumber) {
  const q = new URLSearchParams({ welcome: '1' });
  if (phoneNumber) q.set('from', String(phoneNumber));
  return `/sms?${q.toString()}`;
}

export function suggestedFundAmount(pending) {
  const price = Number(pending?.price || pending?.amount || 0);
  if (!Number.isFinite(price) || price <= 0) return 2;
  return Math.max(2, Math.ceil(price));
}

export function pathForPendingResume() {
  const pending = peekPendingNumberPurchase();
  if (!pending) return '/browse-numbers?first=1';
  return '/first-hour';
}
