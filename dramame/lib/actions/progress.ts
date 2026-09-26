"use server";

import { revalidatePath } from "next/cache";
import { PREVIEW_EPISODES, PREVIEW_SERIES_ID } from "@/lib/episodes";
import { getCurrentUser } from "@/lib/session";
import { saveProgress } from "@/lib/users";

export async function savePreviewProgress(highestOpened: number) {
  const user = await getCurrentUser();
  if (!user) return;
  if (!Number.isInteger(highestOpened) || highestOpened < 1 || highestOpened > PREVIEW_EPISODES.length) return;
  saveProgress(user.id, PREVIEW_SERIES_ID, highestOpened);
  revalidatePath("/library");
}
