import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth-panel";
import { LoginForm } from "@/components/login-form";
import { getCurrentUser } from "@/lib/session";
import { socialConfig } from "@/lib/providers";
import { safeNextPath } from "@/lib/validators";

export const metadata: Metadata = { title: "Log in" };

const SOCIAL_ERRORS: Record<string, string> = {
  Configuration: "That sign-in method is not configured.",
  AccessDenied: "Sign-in was cancelled or denied.",
  OAuthAccountNotLinked: "That email is already used with a different sign-in method.",
  CallbackRouteError: "The provider did not complete sign-in.",
  CredentialsSignin: "That email or password does not match.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reset?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;
  if (user) redirect(safeNextPath(params.callbackUrl));
  const socialError = params.error ? (SOCIAL_ERRORS[params.error] ?? "Sign-in did not complete. You can use email and password.") : undefined;
  const notice = params.reset === "1" ? "Password updated. Log in with the new one." : undefined;
  return (
    <main>
      <AuthPanel title="Log in" lede="Email and password work on this server. Social sign-in appears when provider keys are set.">
        <LoginForm flags={socialConfig()} callbackUrl={safeNextPath(params.callbackUrl)} notice={notice} socialError={socialError} />
      </AuthPanel>
    </main>
  );
}
