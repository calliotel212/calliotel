const TOKEN_KEY = "calliotel_access_token";

export function saveAccessToken(token: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearAccessToken(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}
