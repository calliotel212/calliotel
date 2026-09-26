"use client";

import { useActionState } from "react";
import { resendVerification } from "@/lib/actions/auth";
import { DevNotice } from "@/components/dev-notice";
import { initialFormState } from "@/lib/form-state";

export function ResendForm() {
  const [state, action, pending] = useActionState(resendVerification, initialFormState);
  return (
    <form action={action} className="inline-form" aria-busy={pending}>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      {state.message ? <p className="form-note" role="status">{state.message}</p> : null}
      <button className="button button-ghost" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Resend verification"}
      </button>
      <DevNotice url={state.devUrl} detail="New verification link. It is also printed in the server log." />
    </form>
  );
}
