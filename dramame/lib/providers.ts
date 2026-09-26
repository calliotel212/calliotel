import "server-only";

import type { SocialFlags } from "@/lib/social";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export function socialConfig(): SocialFlags {
  return {
    google: Boolean(env("AUTH_GOOGLE_ID") && env("AUTH_GOOGLE_SECRET")),
    facebook: Boolean(env("AUTH_FACEBOOK_ID") && env("AUTH_FACEBOOK_SECRET")),
    apple: Boolean(env("AUTH_APPLE_ID") && env("AUTH_APPLE_SECRET")),
  };
}
