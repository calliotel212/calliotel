import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { SignupForm } from "@/components/signup-form";
import { socialConfig } from "@/lib/providers";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/account");
  return (
    <main>
      <AuthPanel title="Create an account" lede="Name, email, and a password. You will confirm the terms before the account is saved.">
        <SignupForm flags={socialConfig()} />
      </AuthPanel>
    </main>
  );
}
