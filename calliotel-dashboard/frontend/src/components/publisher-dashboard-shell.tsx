"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import {
  clearPublisherAccessToken,
  getPublisherAccessToken,
  logoutPublisher,
} from "@/lib/publisher-auth";

type PublisherMe = {
  email: string;
  name: string;
};

export function PublisherDashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<PublisherMe | null>(null);

  useEffect(() => {
    const token = getPublisherAccessToken();
    if (!token) {
      router.replace("/publishers");
      return;
    }
    apiGet<PublisherMe>("/api/v1/publishers/me", token)
      .then((data) => setMe({ email: data.email, name: data.name }))
      .catch(() => {
        clearPublisherAccessToken();
        router.replace("/publishers");
      })
      .finally(() => setReady(true));
  }, [router]);

  function onLogout() {
    logoutPublisher();
    router.replace("/publishers");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ads-navy text-sm text-slate-300">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ads-navy text-slate-100">
      <header className="border-b border-slate-700/80 bg-ads-slate">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ads-teal">AdsFind Publisher</p>
            <h1 className="text-lg font-semibold text-white">{me?.name}</h1>
            <p className="text-xs text-slate-400">{me?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/publishers" className="text-sm text-slate-400 hover:text-ads-teal">
              Home
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-200 hover:border-ads-teal hover:text-ads-teal"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">{children}</main>
    </div>
  );
}