"use client";

import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/lib/actions/auth";
import { DevNotice } from "@/components/dev-notice";
import { PopcornLoader } from "@/components/popcorn-loader";
import { PasswordField } from "@/components/password-field";
import { SocialButtons } from "@/components/social-buttons";
import { initialFormState } from "@/lib/form-state";
import type { SocialFlags } from "@/lib/social";

export function LoginForm({
  flags,
  callbackUrl,
  notice,
  socialError,
}: {
  flags: SocialFlags;
  callbackUrl: string;
  notice?: string;
  socialError?: string;
}) {
  const [state, action, pending] = useActionState(login, initialFormState);
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      {notice ? <p className="form-note" role="status">{notice}</p> : null}
      {socialError ? <p className="form-error" role="alert">{socialError}</p> : null}
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" aria-invalid={state.fieldErrors.email ? true : undefined} aria-describedby={state.fieldErrors.email ? "email-error" : undefined} />
        {state.fieldErrors.email ? <p id="email-error" className="field-error" role="alert">{state.fieldErrors.email}</p> : null}
      </div>
      <PasswordField id="password" name="password" label="Password" autoComplete="current-password" error={state.fieldErrors.password} />
      <label className="check">
        <input type="checkbox" name="remember" />
        <span>Remember me</span>
      </label>
      <button className={pending ? "button button-primary is-loading" : "button button-primary"} type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <PopcornLoader size="sm" label="Signing in" /> : "Log in"}
      </button>
      <p className="form-links">
        <Link href="/forgot-password">Forgot password</Link>
        <Link href="/signup">Create an account</Link>
      </p>
      <SocialButtons flags={flags} callbackUrl={callbackUrl} />
      <DevNotice url={state.devUrl} detail="This server does not send email. The link is also printed in the server log." />
    </form>
  );
}
