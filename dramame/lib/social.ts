/**
 * Follow links. Instagram is a follow link only. There is no Instagram OAuth login.
 * Entries that still use an unfinished profile segment are omitted from
 * VISIBLE_SOCIAL_LINKS so the site does not render them.
 */
const UNFINISHED_PROFILE = "REPLACE_WITH_DRAMAME_PROFILE";

export const SOCIAL_LINKS = [
  { name: "Instagram", href: "https://instagram.com/REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "Facebook", href: "https://facebook.com/REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "YouTube", href: "https://youtube.com/@REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "TikTok", href: "https://www.tiktok.com/@REPLACE_WITH_DRAMAME_PROFILE" },
  { name: "X", href: "https://x.com/REPLACE_WITH_DRAMAME_PROFILE" },
] as const;

export const VISIBLE_SOCIAL_LINKS = SOCIAL_LINKS.filter(
  (link) => link.href.length > 0 && !link.href.includes(UNFINISHED_PROFILE),
);

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

/** Posting providers. These are not sign-in methods. */
export const AUTO_POST_PROVIDERS = ["tiktok", "instagram"] as const;
export type AutoPostProvider = (typeof AUTO_POST_PROVIDERS)[number];

export function isAutoPostProvider(value: string): value is AutoPostProvider {
  return (AUTO_POST_PROVIDERS as readonly string[]).includes(value);
}

export function autoPostProviderLabel(provider: AutoPostProvider): string {
  return provider === "tiktok" ? "TikTok" : "Instagram";
}
