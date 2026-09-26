import type { Metadata } from "next";
import { PasswordForm } from "@/components/password-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Password" };

export default async function PasswordPage() {
  const user = await requireUser();
  return (
    <main className="page">
      <h1>Password</h1>
      <p className="lede">Change the password used with your email.</p>
      <PasswordForm hasPassword={Boolean(user.passwordHash)} />
    </main>
  );
}
