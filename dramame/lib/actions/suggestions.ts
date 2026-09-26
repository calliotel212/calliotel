"use server";

import { field, type FormState } from "@/lib/form-state";
import { validateSuggestion } from "@/lib/validators";
import { saveSuggestion } from "@/lib/users";

export async function sendSuggestion(_prev: FormState, formData: FormData): Promise<FormState> {
  const idea = field(formData, "idea");
  const email = field(formData, "email");
  const fieldErrors = validateSuggestion({ idea, email });
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  saveSuggestion({ idea, email });
  return {
    fieldErrors: {},
    ok: true,
    message: "Your idea is saved on this server. Compensation is not decided, and this does not unlock anything or start a payment.",
  };
}
