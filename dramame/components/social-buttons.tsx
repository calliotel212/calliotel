"use client";

import { signIn } from "next-auth/react";
import type { SocialFlags } from "@/lib/social";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "apple", label: "Apple" },
] as const;

export function SocialButtons({ flags, callbackUrl = "/account" }: { flags: SocialFlags; callbackUrl?: string }) {
  return (
    <div className="social-stack">
      <p className="hint">Google, Facebook, and Apple use Auth.js. Without keys, each button stays on “Not configured.”</p>
      {PROVIDERS.map((provider) => {
        const configured = flags[provider.id];
        const stateId = `${provider.id}-state`;
        return (
          <button
            key={provider.id}
            type="button"
            className="button button-ghost social-button"
            aria-disabled={configured ? undefined : true}
            aria-describedby={configured ? undefined : stateId}
            onClick={() => {
              if (!configured) return;
              void signIn(provider.id, { callbackUrl });
            }}
          >
            <span>Continue with {provider.label}</span>
            {configured ? null : (
              <span id={stateId} className="social-state">
                Not configured
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
