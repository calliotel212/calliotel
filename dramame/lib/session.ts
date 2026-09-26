import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { findUserById, type UserRecord } from "@/lib/users";

export const getCurrentUser = cache(async (): Promise<UserRecord | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  return findUserById(id);
});

export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/account");
  return user;
}
