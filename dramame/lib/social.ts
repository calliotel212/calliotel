/**
 * PLACEHOLDER profile URLs.
 * These are not real dramame accounts. Replace each href with the live
 * profile before launch. The REPLACE_WITH_DRAMAME_PROFILE segment is
 * intentional so the links are obviously unfinished.
 *
 * Instagram is a follow link only. There is no Instagram OAuth login.
 */
export const SOCIAL_LINKS = [
  { name: "Instagram", href: "https://instagram.com/REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "Facebook", href: "https://facebook.com/REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "YouTube", href: "https://youtube.com/@REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "TikTok", href: "https://www.tiktok.com/@REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "X", href: "https://x.com/REPLACE_WITH_DRAMAME_PROFILE" },
] as const;

export type SocialFlags = {
  google: boolean;
  facebook: boolean;
  apple: boolean;
};

export const OAUTH_PROVIDERS = ["google", "facebook", "apple"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}
