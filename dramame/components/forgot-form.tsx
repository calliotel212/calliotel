"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword } from "@/lib/actions/auth";
import { DevNotice } from "@/components/dev-notice";
import { initialFormState } from "@/lib/form-state";

export function ForgotForm() {
  const [state, action, pending] = useActionState(forgotPassword, initialFormState);
  if (state.ok) {
    return (
      <div className="form" role="status">
        <p className="form-note">{state.message} Email is not sent by this demo.</p>
        <DevNotice url={state.devUrl} detail="Use this reset link. The same URL is printed in the server log." />
        {state.devUrl ? null : <p className="hint">In local development the reset link appears here and in the server log.</p>}
        <p className="form-links">
          <Link href="/login">Back to log in</Link>
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" aria-invalid={state.fieldErrors.email ? true : undefined} aria-describedby={state.fieldErrors.email ? "email-error" : undefined} />
        {state.fieldErrors.email ? <p id="email-error" className="field-error" role="alert">{state.fieldErrors.email}</p> : null}
      </div>
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Send reset link"}
      </button>
      <p className="form-links">
        <Link href="/login">Back to log in</Link>
      </p>
    </form>
  );
}
