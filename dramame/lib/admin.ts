import "server-only";

import { connection } from "next/server";
import { getCurrentUser } from "@/lib/session";
import type { UserRecord } from "@/lib/users";

export function adminEmail(): string | null {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return value || null;
}

export async function adminViewer(): Promise<UserRecord | null> {
  const allowed = adminEmail();
  if (!allowed) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.email.trim().toLowerCase() !== allowed) return null;
  return user;
}

export async function guardAdmin(): Promise<UserRecord | null> {
  await connection();
  return adminViewer();
}
