import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth-panel";
import { VerifyForm } from "@/components/verify-form";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <main>
      <AuthPanel title="Verify email" lede="Confirm the address on your dramame account.">
        <VerifyForm token={token} />
      </AuthPanel>
    </main>
  );
}
