"use client";

import { useActionState } from "react";
import { updateProfileAction } from "@/lib/actions/account";
import { DevNotice } from "@/components/dev-notice";
import { initialFormState } from "@/lib/form-state";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfileAction, initialFormState);
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      {state.message ? <p className="form-note" role="status">{state.message}</p> : null}
      <div className="field">
        <label htmlFor="name">Display name</label>
        <input id="name" name="name" type="text" autoComplete="name" defaultValue={name} aria-invalid={state.fieldErrors.name ? true : undefined} aria-describedby={state.fieldErrors.name ? "name-error" : undefined} />
        {state.fieldErrors.name ? <p id="name-error" className="field-error" role="alert">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" defaultValue={email} aria-invalid={state.fieldErrors.email ? true : undefined} aria-describedby={state.fieldErrors.email ? "email-error" : undefined} />
        {state.fieldErrors.email ? <p id="email-error" className="field-error" role="alert">{state.fieldErrors.email}</p> : null}
      </div>
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Save profile"}
      </button>
      <DevNotice url={state.devUrl} detail="The new email needs verification. The link is also in the server log." />
    </form>
  );
}
