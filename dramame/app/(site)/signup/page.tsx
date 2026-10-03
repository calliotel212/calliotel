import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { SignupForm } from "@/components/signup-form";
import { normalizePlan, PLANS } from "@/lib/plans";
import { socialConfig } from "@/lib/providers";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  if (await getCurrentUser()) redirect("/account");
  const { plan: planParam } = await searchParams;
  const plan = normalizePlan(planParam);
  const selected = plan ? PLANS.find((item) => item.id === plan) : null;
  const lede = selected
    ? `${selected.name} is selected (${selected.price}). No checkout yet. Name, email, and a password. You will confirm the terms before the account is saved.`
    : "Name, email, and a password. You will confirm the terms before the account is saved.";
  return (
    <main>
      <AuthPanel title="Create an account" lede={lede}>
        <SignupForm flags={socialConfig()} plan={plan} />
      </AuthPanel>
    </main>
  );
}
