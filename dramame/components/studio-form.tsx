"use client";

import { useActionState } from "react";
import { sendStudioRequest } from "@/lib/actions/studio";
import { PopcornLoader } from "@/components/popcorn-loader";
import { initialFormState } from "@/lib/form-state";

export function StudioForm() {
  const [state, action, pending] = useActionState(sendStudioRequest, initialFormState);
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
        Sending an idea does not start a series, connect TikTok or Instagram, or take a payment.
      </p>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" required aria-invalid={state.fieldErrors.name ? true : undefined} aria-describedby={state.fieldErrors.name ? "name-error" : undefined} />
        {state.fieldErrors.name ? <p id="name-error" className="field-error" role="alert">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required aria-invalid={state.fieldErrors.email ? true : undefined} aria-describedby={state.fieldErrors.email ? "email-error" : undefined} />
        {state.fieldErrors.email ? <p id="email-error" className="field-error" role="alert">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="idea">One-line story idea</label>
        <input id="idea" name="idea" type="text" required maxLength={200} aria-invalid={state.fieldErrors.idea ? true : undefined} aria-describedby={state.fieldErrors.idea ? "idea-error" : undefined} />
        {state.fieldErrors.idea ? <p id="idea-error" className="field-error" role="alert">{state.fieldErrors.idea}</p> : null}
      </div>
      <button className={pending ? "button button-primary is-loading" : "button button-primary"} type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <PopcornLoader size="sm" label="Sending your idea" /> : "Submit idea"}
      </button>
    </form>
  );
}
