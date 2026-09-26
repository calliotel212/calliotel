import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-panel";
import { ResetForm } from "@/components/reset-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main>
      <AuthPanel title="Reset password" lede="Choose a new password for this account.">
        <ResetForm token={token} />
      </AuthPanel>
    </main>
  );
}
