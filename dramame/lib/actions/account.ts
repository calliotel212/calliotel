"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { field, isDevRuntime, type FormState } from "@/lib/form-state";
import { appOrigin } from "@/lib/origin";
import { requireUser } from "@/lib/session";
import { isOAuthProvider } from "@/lib/social";
import { validateEmail, validateName, validateNewPassword } from "@/lib/validators";
import {
  changePassword,
  deleteUser,
  disconnectProvider,
  recordDevLink,
  savePreferences,
  updateProfile,
} from "@/lib/users";

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = field(formData, "name");
  const email = field(formData, "email");
  const fieldErrors: Record<string, string> = {};
  const nameError = validateName(name);
  if (nameError) fieldErrors.name = nameError;
  const emailError = validateEmail(email);
  if (emailError) fieldErrors.email = emailError;
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const result = updateProfile(user.id, { name, email });
  if (!result.ok) return { fieldErrors: {}, formError: result.error };

  let devUrl: string | undefined;
  if (result.verifyToken) {
    const origin = await appOrigin();
    const url = `${origin}/verify-email?token=${result.verifyToken}`;
    recordDevLink({ userId: user.id, email: result.email, kind: "verify", url });
    if (isDevRuntime()) devUrl = url;
  }

  revalidatePath("/account");
  revalidatePath("/account/profile");
  return {
    fieldErrors: {},
    ok: true,
    message: result.verifyToken ? "Profile saved. Verify the new email." : "Profile saved.",
    devUrl,
  };
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = field(formData, "current");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");
  const fieldErrors = validateNewPassword(password, confirm);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  const result = changePassword(user.id, { current, next: password });
  if (!result.ok) return { fieldErrors: {}, formError: result.error };
  return { fieldErrors: {}, ok: true, message: user.passwordHash ? "Password updated." : "Password set." };
}

export async function savePreferencesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  savePreferences(user.id, {
    episodeAlerts: formData.get("episodeAlerts") === "on",
    productNews: formData.get("productNews") === "on",
    securityEmail: formData.get("securityEmail") === "on",
  });
  revalidatePath("/account/notifications");
  return { fieldErrors: {}, ok: true, message: "Preferences saved." };
}

export async function disconnectAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const provider = field(formData, "provider");
  if (!isOAuthProvider(provider)) return { fieldErrors: {}, formError: "Unknown provider." };
  const result = disconnectProvider(user.id, provider);
  if (!result.ok) return { fieldErrors: {}, formError: result.error };
  revalidatePath("/account/connected");
  return { fieldErrors: {}, ok: true, message: "Disconnected." };
}

export async function deleteAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const confirm = field(formData, "confirm").trim().toLowerCase();
  if (!confirm) return { fieldErrors: { confirm: "Type your email to confirm." } };
  if (confirm !== user.email) return { fieldErrors: { confirm: "That email doesn’t match this account." } };
  deleteUser(user.id);
  await signOut({ redirectTo: "/?deleted=1" });
  return { fieldErrors: {} };
}
