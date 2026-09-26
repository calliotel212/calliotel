import type { Metadata } from "next";
import { ConnectedAccounts } from "@/components/connected-accounts";
import { socialConfig } from "@/lib/providers";
import { requireUser } from "@/lib/session";
import { listOAuth } from "@/lib/users";

export const metadata: Metadata = { title: "Connected accounts" };

export default async function ConnectedPage() {
  const user = await requireUser();
  const linked = listOAuth(user.id).map((row) => row.provider);
  return (
    <main className="page">
      <h1>Connected accounts</h1>
      <p className="lede">Google, Facebook, and Apple can be linked through Auth.js. Instagram is not a sign-in method.</p>
      <ConnectedAccounts flags={socialConfig()} linked={linked} />
    </main>
  );
}
