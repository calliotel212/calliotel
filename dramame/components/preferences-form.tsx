"use client";

import { useActionState } from "react";
import { savePreferencesAction } from "@/lib/actions/account";
import { initialFormState } from "@/lib/form-state";

export function PreferencesForm({
  episodeAlerts,
  productNews,
  securityEmail,
}: {
  episodeAlerts: boolean;
  productNews: boolean;
  securityEmail: boolean;
}) {
  const [state, action, pending] = useActionState(savePreferencesAction, initialFormState);
  return (
    <form action={action} className="form" aria-busy={pending}>
      {state.message ? <p className="form-note" role="status">{state.message}</p> : null}
      <label className="check">
        <input type="checkbox" name="episodeAlerts" defaultChecked={episodeAlerts} />
        <span>Email me when a new episode is published</span>
      </label>
      <label className="check">
        <input type="checkbox" name="productNews" defaultChecked={productNews} />
        <span>Product news from dramame</span>
      </label>
      <label className="check">
        <input type="checkbox" name="securityEmail" defaultChecked={securityEmail} />
        <span>Account security email</span>
      </label>
      <p className="hint">Nothing is publishing yet. These choices are saved for later.</p>
      <button className="button button-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Please wait…" : "Save preferences"}
      </button>
    </form>
  );
}
