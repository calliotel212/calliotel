"use server";

import { revalidatePath } from "next/cache";
import { adminViewer } from "@/lib/admin";
import { setInboxRead, type InboxTable } from "@/lib/admin-data";

async function mark(table: InboxTable, path: string, formData: FormData) {
  if (!(await adminViewer())) return;
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{8,80}$/i.test(id)) return;
  const read = String(formData.get("read") ?? "") === "1";
  await setInboxRead(table, id, read);
  revalidatePath(path);
}

export async function markSuggestionRead(formData: FormData) {
  await mark("suggestions", "/admin/suggestions", formData);
}

export async function markMessageRead(formData: FormData) {
  await mark("messages", "/admin/messages", formData);
}

export async function markRequestRead(formData: FormData) {
  await mark("studio_requests", "/admin/requests", formData);
}
