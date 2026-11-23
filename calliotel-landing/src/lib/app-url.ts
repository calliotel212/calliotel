/**
 * Base URL for the Calliotel app dashboard (advertise, publishers, login).
 * Set NEXT_PUBLIC_APP_URL in production when the landing site and app run on different hosts.
 */
export function getAppBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    return raw.replace(/\/$/, "");
  }
  return "https://app.calliotel.ai";
}

export function appPath(path: string): string {
  const base = getAppBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const APP_LOGIN_URL = () => appPath("/login");
export const APP_ADVERTISE_URL = () => appPath("/advertise");
export const APP_PUBLISHERS_URL = () => appPath("/publishers");