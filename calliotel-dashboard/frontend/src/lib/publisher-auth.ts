const TOKEN_KEY = "publisher_access_token";
const API_KEY_KEY = "publisher_api_key";

export function savePublisherAccessToken(token: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
}

export function savePublisherApiKey(apiKey: string): void {
  if (typeof window !== "undefined") sessionStorage.setItem(API_KEY_KEY, apiKey);
}

export function getPublisherAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function getPublisherApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(API_KEY_KEY);
}

export function clearPublisherAccessToken(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(TOKEN_KEY);
}

export function logoutPublisher(): void {
  clearPublisherAccessToken();
}