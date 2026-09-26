"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions/auth";
import { PasswordField } from "@/components/password-field";
import { initialFormState } from "@/lib/form-state";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialFormState);
  if (!token) {
    return <p className="form-error" role="alert">This reset link is invalid or expired.</p>;
  }
  if (state.ok) {
    return (
      <div className="form" role="status">
        <p className="form-note">{state.message}</p>
        <Link className="button button-primary" href="/login?reset=1">Log in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <PasswordField id="password" name="password" label="New password" autoComplete="new-password" error={state.fieldErrors.password} hint="At least 8 characters, with a letter and a number." />
      <PasswordField id="confirm" name="confirm" label="Confirm password" autoComplete="new-password" error={state.fieldErrors.confirm} />
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Update password"}
      </button>
    </form>
  );
}
