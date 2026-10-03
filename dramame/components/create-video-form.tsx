"use client";

import { useActionState } from "react";
import { PopcornLoader } from "@/components/popcorn-loader";
import { createVideo } from "@/lib/actions/videos";
import { initialFormState } from "@/lib/form-state";
import { PLANS } from "@/lib/plans";

export function CreateVideoForm() {
  const [state, action, pending] = useActionState(createVideo, initialFormState);
  return (
    <form action={action} className="form" noValidate aria-busy={pending}>
      <p className="form-note">No checkout yet. This saves a queued video and does not generate one.</p>
      {state.formError ? <p className="form-error" role="alert">{state.formError}</p> : null}
      <div className="field">
        <label htmlFor="script">Script or story idea</label>
        <textarea
          id="script"
          name="script"
          rows={6}
          required
          aria-invalid={state.fieldErrors.script ? true : undefined}
          aria-describedby={state.fieldErrors.script ? "script-error" : "script-hint"}
        />
        <p id="script-hint" className="hint">10 to 2000 characters.</p>
        {state.fieldErrors.script ? <p id="script-error" className="field-error" role="alert">{state.fieldErrors.script}</p> : null}
      </div>
      <div className="field">
        <label htmlFor="plan">Plan</label>
        <select
          id="plan"
          name="plan"
          defaultValue=""
          required
          aria-invalid={state.fieldErrors.plan ? true : undefined}
          aria-describedby={state.fieldErrors.plan ? "plan-error" : undefined}
        >
          <option value="">Choose a plan</option>
          {PLANS.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.price}
            </option>
          ))}
        </select>
        {state.fieldErrors.plan ? <p id="plan-error" className="field-error" role="alert">{state.fieldErrors.plan}</p> : null}
      </div>
      <button className={pending ? "button button-primary is-loading" : "button button-primary"} type="submit" disabled={pending} aria-busy={pending}>
        {pending ? <PopcornLoader size="sm" label="Saving your video" /> : "Create video"}
      </button>
    </form>
  );
}
