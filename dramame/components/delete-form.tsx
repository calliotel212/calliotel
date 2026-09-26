"use client";

import { useActionState } from "react";
import { deleteAccount } from "@/lib/actions/account";
import { initialFormState } from "@/lib/form-state";

export function DeleteForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(deleteAccount, initialFormState);
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      <p>This removes your profile, password, connected providers, preferences, and preview progress from this server.</p>
      <div className="field">
        <label htmlFor="confirm">Type {email} to confirm</label>
        <input id="confirm" name="confirm" type="email" autoComplete="off" aria-invalid={state.fieldErrors.confirm ? true : undefined} aria-describedby={state.fieldErrors.confirm ? "confirm-error" : undefined} />
        {state.fieldErrors.confirm ? <p id="confirm-error" className="field-error" role="alert">{state.fieldErrors.confirm}</p> : null}
      </div>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <button className="button button-danger" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Delete account"}
      </button>
    </form>
  );
}
