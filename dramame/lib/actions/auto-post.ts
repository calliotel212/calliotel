"use server";

import { revalidatePath } from "next/cache";
import { field, type FormState } from "@/lib/form-state";
import { addPostQueueItem, approvePostQueueItem, isPreviewEpisodeId, removePostQueueItem } from "@/lib/post-queue";
import { requireUser } from "@/lib/session";
import { isAutoPostProvider } from "@/lib/social";

const CAPTION_LIMIT = 2200;

function refresh() {
  revalidatePath("/account/auto-post");
}

export async function addToQueueAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const episodeId = field(formData, "episodeId");
  const provider = field(formData, "provider");
  const caption = field(formData, "caption").trim();
  const scheduledRaw = field(formData, "scheduledAt").trim();
  const fieldErrors: Record<string, string> = {};

  if (!isPreviewEpisodeId(episodeId)) fieldErrors.episodeId = "Choose an episode.";
  if (!isAutoPostProvider(provider)) fieldErrors.provider = "Choose TikTok or Instagram.";
  if (caption.length > CAPTION_LIMIT) fieldErrors.caption = "Use 2,200 characters or fewer.";
  const scheduledAt = Date.parse(scheduledRaw);
  if (!scheduledRaw || !Number.isFinite(scheduledAt)) fieldErrors.scheduledAt = "Choose a date and time.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (!isAutoPostProvider(provider)) return { fieldErrors: {}, formError: "Choose TikTok or Instagram." };
  const result = await addPostQueueItem({
    userId: user.id,
    episodeId,
    provider,
    caption,
    scheduledAt,
  });
  if (!result.ok) return { fieldErrors: {}, formError: result.error };
  refresh();
  return { fieldErrors: {}, ok: true, message: "Added to the queue. Nothing was posted." };
}

export async function queueRowAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = field(formData, "id");
  const intent = field(formData, "intent");
  if (!id) return { fieldErrors: {}, formError: "That queue item was not found." };

  if (intent === "approve") {
    const result = await approvePostQueueItem(user.id, id);
    if (!result.ok) return { fieldErrors: {}, formError: result.error };
    refresh();
    return { fieldErrors: {}, ok: true, message: "Draft approved. Nothing was posted." };
  }

  if (intent === "remove") {
    const result = await removePostQueueItem(user.id, id);
    if (!result.ok) return { fieldErrors: {}, formError: result.error };
    refresh();
    return { fieldErrors: {}, ok: true, message: "Draft removed." };
  }

  return { fieldErrors: {}, formError: "Unknown action." };
}
