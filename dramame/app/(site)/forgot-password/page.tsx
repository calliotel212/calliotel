import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-panel";
import { ForgotForm } from "@/components/forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <main>
      <AuthPanel title="Forgot password" lede="Enter the email on your account. This demo does not send mail. In local development the reset link is shown on the next screen and printed in the server log.">
        <ForgotForm />
      </AuthPanel>
    </main>
  );
}
