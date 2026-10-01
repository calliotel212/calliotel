"use server";

import { saveStudioRequest } from "@/lib/admin-data";
import { field, type FormState } from "@/lib/form-state";
import { validateStudioRequest } from "@/lib/validators";

export async function sendStudioRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const idea = field(formData, "idea");
  const fieldErrors = validateStudioRequest({ name, email, idea });
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  await saveStudioRequest({ name, email, idea });
  return {
    fieldErrors: {},
    ok: true,
    message: "Your request is saved on this server. This does not start a series, connect TikTok or Instagram, or take a payment.",
  };
}
