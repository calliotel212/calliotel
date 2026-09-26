import type { ReactNode } from "react";
import { AccountNav } from "@/components/account-nav";
import { requireUser } from "@/lib/session";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="account">
      <AccountNav name={user.name} email={user.email} />
      <div className="account-main">{children}</div>
    </div>
  );
}
