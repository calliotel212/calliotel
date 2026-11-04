"use client";

import { useActionState } from "react";
import { PopcornLoader } from "@/components/popcorn-loader";
import { createVideo } from "@/lib/actions/videos";
import { initialFormState, type FormState } from "@/lib/form-state";
import { PLANS } from "@/lib/plans";

const IMAGE_ERROR = "Upload a JPG or PNG image.";

function isJpegOrPng(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/png") return true;
  if (type && type !== "application/octet-stream") return false;
  return /\.(jpe?g|png)$/i.test(file.name);
}

function chosenFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size <= 0) return null;
  return value;
}

async function uploadImage(file: File): Promise<string> {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch("/api/upload", { method: "POST", body });
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  const message =
    payload && typeof payload === "object" && typeof (payload as { error?: unknown }).error === "string"
      ? (payload as { error: string }).error
      : "Could not upload the image.";
  if (!response.ok) throw new Error(message);
  const url = payload && typeof payload === "object" ? (payload as { url?: unknown }).url : null;
  if (typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) throw new Error("Could not upload the image.");
  return url.trim();
}

async function submitVideo(_prev: FormState, formData: FormData): Promise<FormState> {
  const character = chosenFile(formData, "characterImage");
  const location = chosenFile(formData, "locationImage");
  formData.delete("characterImage");
  formData.delete("locationImage");

  const fieldErrors: Record<string, string> = {};
  if (character && !isJpegOrPng(character)) fieldErrors.character_image_url = IMAGE_ERROR;
  if (location && !isJpegOrPng(location)) fieldErrors.location_image_url = IMAGE_ERROR;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  try {
    if (character) formData.set("character_image_url", await uploadImage(character));
    if (location) formData.set("location_image_url", await uploadImage(location));
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "Could not upload the image.";
    return { fieldErrors: {}, formError: message };
  }

  return createVideo(_prev, formData);
}

export function CreateVideoForm() {
  const [state, action, pending] = useActionState(submitVideo, initialFormState);
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
        <label htmlFor="character-image">Upload Character Face (JPG/PNG)</label>
        <input
          id="character-image"
          name="characterImage"
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          disabled={pending}
          aria-invalid={state.fieldErrors.character_image_url ? true : undefined}
          aria-describedby={state.fieldErrors.character_image_url ? "character-image-error" : "character-image-hint"}
        />
        <p id="character-image-hint" className="hint">Optional. This face is used for every shot.</p>
        {state.fieldErrors.character_image_url ? (
          <p id="character-image-error" className="field-error" role="alert">{state.fieldErrors.character_image_url}</p>
        ) : null}
      </div>
      <div className="field">
        <label htmlFor="location-image">Upload Location / Map (JPG/PNG)</label>
        <input
          id="location-image"
          name="locationImage"
          type="file"
          accept="image/jpeg,image/png,.jpg,.jpeg,.png"
          disabled={pending}
          aria-invalid={state.fieldErrors.location_image_url ? true : undefined}
          aria-describedby={state.fieldErrors.location_image_url ? "location-image-error" : "location-image-hint"}
        />
        <p id="location-image-hint" className="hint">Optional. Saved with the video.</p>
        {state.fieldErrors.location_image_url ? (
          <p id="location-image-error" className="field-error" role="alert">{state.fieldErrors.location_image_url}</p>
        ) : null}
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
