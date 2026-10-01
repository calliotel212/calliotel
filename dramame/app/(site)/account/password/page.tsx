import type { Metadata } from "next";
import { PasswordForm } from "@/components/password-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Password" };

export default async function PasswordPage() {
  const user = await requireUser();
  const hasPassword = Boolean(user.passwordHash);
  return (
    <main className="page">
      <h1>{hasPassword ? "Password" : "Set a password"}</h1>
      <p className="lede">
        {hasPassword
          ? "Change the password used with your email."
          : "This account has no password yet. Set a password to sign in with email."}
      </p>
      <PasswordForm hasPassword={hasPassword} />
    </main>
  );
}
