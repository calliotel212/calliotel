"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { clearAccessToken, getAccessToken, logout } from "@/lib/auth";

type MeResponse = { email: string; tenant_name: string };

const NAV = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/setup", label: "Setup" },
  { href: "/dashboard/numbers", label: "Numbers" },
  { href: "/dashboard/calls", label: "Calls" },
  { href: "/dashboard/billing", label: "Billing" },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    function loadMe() {
      const t = getAccessToken();
      if (!t) return;
      apiGet<MeResponse>("/api/v1/auth/me", t)
        .then(setMe)
        .catch(() => {
          clearAccessToken();
          router.replace("/login");
        })
        .finally(() => setReady(true));
    }
    loadMe();
    const onTenantUpdated = () => loadMe();
    window.addEventListener("calliotel:tenant-updated", onTenantUpdated);
    return () => window.removeEventListener("calliotel:tenant-updated", onTenantUpdated);
  }, [router]);

  function onLogout() {
    logout();
    router.replace("/login");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-600">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
        <div className="border-b border-slate-200 px-4 py-5">
          <p className="text-sm font-semibold text-brand-600">Calliotel</p>
          <p className="mt-1 truncate text-xs text-slate-500">{me?.tenant_name}</p>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden">
            <p className="text-sm font-semibold text-brand-600">Calliotel</p>
          </div>
          <div className="text-right text-sm">
            <p className="font-medium text-slate-900">{me?.email}</p>
            <p className="hidden text-xs text-slate-500 sm:block">{me?.tenant_name}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="ml-4 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
        </header>
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                pathname === item.href ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}

export function PlaceholderPage({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </div>
  );
}
