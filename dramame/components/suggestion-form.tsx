"use client";

import { useActionState } from "react";
import { sendSuggestion } from "@/lib/actions/suggestions";
import { PopcornLoader } from "@/components/popcorn-loader";
import { initialFormState } from "@/lib/form-state";

export function SuggestionForm() {
  const [state, action, pending] = useActionState(sendSuggestion, initialFormState);
  if (state.ok) {
    return (
      <p className="form-note" role="status">
        {state.message}
      </p>
    );
  }
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      <p className="form-note">
        Compensation is not decided. Sending an idea does not pay you, unlock a free watch, or start a purchase.
      </p>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <div className="field">
        <label htmlFor="idea">Story idea</label>
        <textarea id="idea" name="idea" rows={6} required aria-invalid={state.fieldErrors.idea ? true : undefined} aria-describedby={state.fieldErrors.idea ? "idea-error" : undefined} />
        {state.fieldErrors.idea ? <p id="idea-error" className="field-error" role="alert">{state.fieldErrors.idea}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="email">Email, optional</label>
        <input id="email" name="email" type="email" autoComplete="email" aria-invalid={state.fieldErrors.email ? true : undefined} aria-describedby={state.fieldErrors.email ? "email-error" : undefined} />
        {state.fieldErrors.email ? <p id="email-error" className="field-error" role="alert">{state.fieldErrors.email}</p> : null}
      </div>
      <button className={pending ? "button button-primary is-loading" : "button button-primary"} type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <PopcornLoader size="sm" label="Sending your idea" /> : "Submit idea"}
      </button>
    </form>
  );
}
