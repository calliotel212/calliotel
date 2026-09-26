"use client";

import { useActionState } from "react";
import { signIn } from "next-auth/react";
import { disconnectAccount } from "@/lib/actions/account";
import { initialFormState } from "@/lib/form-state";
import type { SocialFlags } from "@/lib/social";

const PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "apple", label: "Apple" },
] as const;

export function ConnectedAccounts({ flags, linked }: { flags: SocialFlags; linked: string[] }) {
  const [state, action, pending] = useActionState(disconnectAccount, initialFormState);
  return (
    <div className="stack">
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      {state.message ? <p className="form-note" role="status">{state.message}</p> : null}
      <ul className="provider-list">
        {PROVIDERS.map((provider) => {
          const configured = flags[provider.id];
          const connected = linked.includes(provider.id);
          const stateId = `${provider.id}-account-state`;
          return (
            <li key={provider.id}>
              <div>
                <p className="provider-name">{provider.label}</p>
                <p className="hint">{connected ? "Connected" : "Not connected"}</p>
              </div>
              {connected ? (
                <form action={action}>
                  <input type="hidden" name="provider" value={provider.id} />
                  <button className="button button-ghost" type="submit" disabled={pending}>
                    {pending ? "Please wait…" : "Disconnect"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="button button-ghost"
                  aria-disabled={configured ? undefined : true}
                  aria-describedby={configured ? undefined : stateId}
                  onClick={() => {
                    if (!configured) return;
                    void signIn(provider.id, { callbackUrl: "/account/connected" });
                  }}
                >
                  {configured ? `Connect ${provider.label}` : "Not configured"}
                  {configured ? null : <span id={stateId} className="sr-only">Sign-in keys are missing.</span>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
