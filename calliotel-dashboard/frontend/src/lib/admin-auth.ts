const ADMIN_TOKEN_KEY = "calliotel_admin_token";

export function getAdminAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminAccessToken(token: string): void {
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminAccessToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}