"use server";

import { redirect } from "next/navigation";
import { field, type FormState } from "@/lib/form-state";
import { normalizePlan } from "@/lib/plans";
import { getCurrentUser } from "@/lib/session";
import { validateVideoRequest } from "@/lib/validators";
import { createQueuedVideo, storedImageUrl } from "@/lib/videos";

const IMAGE_ERROR = "Upload a JPG or PNG image.";

// Saves a queued row and the script. Do not call generateVideo from this action.
export async function createVideo(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { fieldErrors: {}, formError: "Log in to create a video." };

  const script = field(formData, "script");
  const plan = normalizePlan(field(formData, "plan"));
  const fieldErrors = validateVideoRequest({ script, plan });
  const characterRaw = field(formData, "character_image_url").trim();
  const locationRaw = field(formData, "location_image_url").trim();
  const characterImageUrl = storedImageUrl(characterRaw);
  const locationImageUrl = storedImageUrl(locationRaw);
  if (characterRaw && !characterImageUrl) fieldErrors.character_image_url = IMAGE_ERROR;
  if (locationRaw && !locationImageUrl) fieldErrors.location_image_url = IMAGE_ERROR;
  if (!plan || Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const id = await createQueuedVideo({
    userId: user.id,
    planId: plan,
    script,
    characterImageUrl,
    locationImageUrl,
  });
  redirect(`/account/videos/${id}`);
}
