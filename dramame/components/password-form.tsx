"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/lib/actions/account";
import { PasswordField } from "@/components/password-field";
import { initialFormState } from "@/lib/form-state";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, initialFormState);
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      {state.message ? <p className="form-note" role="status">{state.message}</p> : null}
      {hasPassword ? (
        <PasswordField id="current" name="current" label="Current password" autoComplete="current-password" />
      ) : (
        <p className="hint">This account has no password yet. Set one to sign in with email.</p>
      )}
      <PasswordField id="password" name="password" label="New password" autoComplete="new-password" error={state.fieldErrors.password} hint="At least 8 characters, with a letter and a number." />
      <PasswordField id="confirm" name="confirm" label="Confirm new password" autoComplete="new-password" error={state.fieldErrors.confirm} />
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : hasPassword ? "Update password" : "Set password"}
      </button>
    </form>
  );
}
