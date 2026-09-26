"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/lib/actions/auth";
import { DevNotice } from "@/components/dev-notice";
import { PasswordField } from "@/components/password-field";
import { SocialButtons } from "@/components/social-buttons";
import { initialFormState } from "@/lib/form-state";
import type { SocialFlags } from "@/lib/social";

const HINT = "At least 8 characters, with a letter and a number.";

export function SignupForm({ flags }: { flags: SocialFlags }) {
  const [state, action, pending] = useActionState(signup, initialFormState);
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
      <PasswordField id="password" name="password" label="Password" autoComplete="new-password" error={state.fieldErrors.password} hint={HINT} />
      <PasswordField id="confirm" name="confirm" label="Confirm password" autoComplete="new-password" error={state.fieldErrors.confirm} />
      <div className="field">
        <label className="check">
          <input type="checkbox" name="terms" aria-invalid={state.fieldErrors.terms ? true : undefined} aria-describedby={state.fieldErrors.terms ? "terms-error" : undefined} />
          <span>
            I agree to the <Link href="/terms">terms of service</Link> and <Link href="/privacy">privacy policy</Link>.
          </span>
        </label>
        {state.fieldErrors.terms ? <p id="terms-error" className="field-error" role="alert">{state.fieldErrors.terms}</p> : null}
      </div>
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Create account"}
      </button>
      <p className="form-links">
        <Link href="/login">Already have an account? Log in</Link>
      </p>
      <SocialButtons flags={flags} />
      <DevNotice url={state.devUrl} detail="This server does not send email. The verification link is also printed in the server log." />
    </form>
  );
}
