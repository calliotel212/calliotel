"use server";

import { redirect } from "next/navigation";
import { field, type FormState } from "@/lib/form-state";
import { normalizePlan } from "@/lib/plans";
import { getCurrentUser } from "@/lib/session";
import { validateVideoRequest } from "@/lib/validators";
import { createQueuedVideo } from "@/lib/videos";

// Saves a queued row and the script. Do not call generateVideo from this action.
export async function createVideo(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { fieldErrors: {}, formError: "Log in to create a video." };

  const script = field(formData, "script");
  const plan = normalizePlan(field(formData, "plan"));
  const fieldErrors = validateVideoRequest({ script, plan });
  if (!plan || Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const id = await createQueuedVideo({ userId: user.id, planId: plan, script });
  redirect(`/account/videos/${id}`);
}
