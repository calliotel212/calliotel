const TOKEN_KEY = "advertiser_access_token";

export function saveAdvertiserAccessToken(token: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function getAdvertiserAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearAdvertiserAccessToken(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

export function logoutAdvertiser(): void {
  clearAdvertiserAccessToken();
}