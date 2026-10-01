import type { ReactNode } from "react";
import { AccountNav } from "@/components/account-nav";
import { adminEmail } from "@/lib/admin";
import { requireUser } from "@/lib/session";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const allowed = adminEmail();
  const showAdmin = Boolean(allowed && user.email.trim().toLowerCase() === allowed);
  return (
    <div className="account">
      <AccountNav name={user.name} email={user.email} showAdmin={showAdmin} />
      <div className="account-main">{children}</div>
    </div>
  );
}
