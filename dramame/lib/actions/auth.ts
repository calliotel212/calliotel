"use server";

import { unstable_rethrow } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { field, initialFormState, isDevRuntime, type FormState } from "@/lib/form-state";
import { appOrigin } from "@/lib/origin";
import { safeNextPath, validateEmail, validateLogin, validateNewPassword, validateSignup } from "@/lib/validators";
import {
  authenticate,
  createResetToken,
  createUser,
  findUserByEmail,
  recordDevLink,
  resendVerification as issueVerification,
  resetPassword,
  verifyEmailToken,
} from "@/lib/users";
import { getCurrentUser } from "@/lib/session";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  const password = field(formData, "password");
  const remember = formData.get("remember") === "on";
  const callbackUrl = safeNextPath(field(formData, "callbackUrl"));
  const fieldErrors = validateLogin({ email, password });
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const result = authenticate(email, password);
  if (result.status === "unknown") return { fieldErrors: {}, formError: "No account uses that email." };
  if (result.status === "social") {
    return { fieldErrors: {}, formError: "That email uses social sign-in. Continue with the provider, or reset the password to set one." };
  }
  if (result.status === "wrong") return { fieldErrors: {}, formError: "That password doesn’t match." };

  try {
    await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      remember: remember ? "yes" : "no",
      redirectTo: callbackUrl,
    });
  } catch (error) {
    unstable_rethrow(error);
    return { fieldErrors: {}, formError: "Could not sign you in." };
  }
  return initialFormState;
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = field(formData, "name");
  const email = field(formData, "email");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");
  const terms = formData.get("terms") === "on";
  const fieldErrors = validateSignup({ name, email, password, confirm, terms });
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  if (findUserByEmail(email)) return { fieldErrors: {}, formError: "An account already uses that email." };

  const created = createUser({ name, email, password });
  const origin = await appOrigin();
  const devUrl = `${origin}/verify-email?token=${created.verifyToken}`;
  recordDevLink({ userId: created.user.id, email: created.user.email, kind: "verify", url: devUrl });

  try {
    await signIn("credentials", {
      email: created.user.email,
      password,
      remember: "yes",
      redirectTo: "/account",
    });
  } catch (error) {
    unstable_rethrow(error);
    return {
      fieldErrors: {},
      formError: "Account created, but sign-in failed. Log in with your email and password.",
      devUrl: isDevRuntime() ? devUrl : undefined,
    };
  }
  return initialFormState;
}

export async function forgotPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = field(formData, "email");
  const emailError = validateEmail(email);
  if (emailError) return { fieldErrors: { email: emailError } };

  const result = createResetToken(email);
  if (!result.ok) return { fieldErrors: {}, formError: result.error };

  const origin = await appOrigin();
  const url = `${origin}/reset-password?token=${result.token}`;
  recordDevLink({ userId: result.user.id, email: result.user.email, kind: "reset", url });
  return {
    fieldErrors: {},
    ok: true,
    message: "Reset link ready.",
    devUrl: isDevRuntime() ? url : undefined,
  };
}

export async function resetPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = field(formData, "token");
  const password = field(formData, "password");
  const confirm = field(formData, "confirm");
  if (!token) return { fieldErrors: {}, formError: "This reset link is invalid or expired." };
  const fieldErrors = validateNewPassword(password, confirm);
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  const result = resetPassword(token, password);
  if (!result.ok) return { fieldErrors: {}, formError: result.error };
  return { fieldErrors: {}, ok: true, message: "Password updated. You can log in." };
}

export async function verifyEmailAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = field(formData, "token");
  if (!token) return { fieldErrors: {}, formError: "This verification link is invalid or expired." };
  const result = verifyEmailToken(token);
  if (!result.ok) return { fieldErrors: {}, formError: result.error };
  return { fieldErrors: {}, ok: true, message: "Email verified." };
}

export async function resendVerification(_prev: FormState, _formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { fieldErrors: {}, formError: "Log in to resend verification." };
  const result = issueVerification(user.id);
  if (!result.ok) return { fieldErrors: {}, formError: result.error };
  const origin = await appOrigin();
  const url = `${origin}/verify-email?token=${result.token}`;
  recordDevLink({ userId: user.id, email: result.email, kind: "verify", url });
  return {
    fieldErrors: {},
    ok: true,
    message: "A new verification link is ready.",
    devUrl: isDevRuntime() ? url : undefined,
  };
}

export async function logout() {
  await signOut({ redirectTo: "/" });
}
