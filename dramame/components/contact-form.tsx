"use client";

import { useActionState } from "react";
import { sendContact } from "@/lib/actions/contact";
import { initialFormState } from "@/lib/form-state";

export function ContactForm() {
  const [state, action, pending] = useActionState(sendContact, initialFormState);
  if (state.ok) return <p className="form-note" role="status">{state.message}</p>;
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <div className="field">
        <label htmlFor="name">Name</label>
        <input id="name" name="name" type="text" autoComplete="name" aria-invalid={state.fieldErrors.name ? true : undefined} aria-describedby={state.fieldErrors.name ? "name-error" : undefined} />
        {state.fieldErrors.name ? <p id="name-error" className="field-error" role="alert">{state.fieldErrors.name}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" aria-invalid={state.fieldErrors.email ? true : undefined} aria-describedby={state.fieldErrors.email ? "email-error" : undefined} />
        {state.fieldErrors.email ? <p id="email-error" className="field-error" role="alert">{state.fieldErrors.email}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="message">Message</label>
        <textarea id="message" name="message" rows={6} aria-invalid={state.fieldErrors.message ? true : undefined} aria-describedby={state.fieldErrors.message ? "message-error" : undefined} />
        {state.fieldErrors.message ? <p id="message-error" className="field-error" role="alert">{state.fieldErrors.message}</p> : null}
      </div>
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Send message"}
      </button>
    </form>
  );
}
