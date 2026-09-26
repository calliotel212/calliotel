"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions/auth";

const LINKS = [
  { href: "/account", label: "Home" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/password", label: "Password" },
  { href: "/account/connected", label: "Connected accounts" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/delete", label: "Delete account" },
];

export function AccountNav({ name, email }: { name: string; email: string }) {
  const pathname = usePathname();
  return (
    <aside className="account-nav">
      <p className="eyebrow">Account</p>
      <p className="account-name">{name}</p>
      <p className="hint">{email}</p>
      <nav aria-label="Account">
        {LINKS.map((link) => {
          const active = link.href === "/account" ? pathname === "/account" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <form action={logout}>
        <button type="submit" className="text-button">
          Log out
        </button>
      </form>
    </aside>
  );
}
