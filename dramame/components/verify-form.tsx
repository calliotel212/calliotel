"use client";

import Link from "next/link";
import { useActionState } from "react";
import { verifyEmailAction } from "@/lib/actions/auth";
import { initialFormState } from "@/lib/form-state";

export function VerifyForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(verifyEmailAction, initialFormState);
  if (!token) return <p className="form-error" role="alert">This verification link is invalid or expired.</p>;
  if (state.ok) {
    return (
      <div className="form" role="status">
        <p className="form-note">{state.message}</p>
        <Link className="button button-primary" href="/account">Go to your account</Link>
      </div>
    );
  }
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <p className="hint">Confirm to mark this email as verified. The link is not used until you press the button, so a prefetch cannot burn it.</p>
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Verify email"}
      </button>
    </form>
  );
}
