"use server";

import { field, type FormState } from "@/lib/form-state";
import { validateContact } from "@/lib/validators";
import { saveMessage } from "@/lib/users";

export async function sendContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const message = field(formData, "message");
  const fieldErrors = validateContact({ name, email, message });
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  saveMessage({ name, email, message });
  return { fieldErrors: {}, ok: true, message: "Message saved on this server. You can also write to hello@dramame.net." };
}
