"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import {
  clearAdvertiserAccessToken,
  getAdvertiserAccessToken,
  logoutAdvertiser,
} from "@/lib/advertiser-auth";

type AdvertiserMe = {
  email: string;
  business_name: string;
  wallet_balance: string;
  phone_number?: string | null;
  website_url?: string | null;
  kyc_status: string;
};

function kycBadge(status: string) {
  const base = "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  switch (status) {
    case "approved":
      return `${base} bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30`;
    case "rejected":
      return `${base} bg-red-500/20 text-red-300 ring-1 ring-red-500/30`;
    case "in_review":
      return `${base} bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30`;
    default:
      return `${base} bg-slate-600/40 text-slate-300 ring-1 ring-slate-500/30`;
  }
}

function kycLabel(status: string) {
  if (status === "approved") return "Verified";
  if (status === "rejected") return "KYC declined";
  if (status === "in_review") return "In review";
  return "Unverified";
}

export function AdvertiserDashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<AdvertiserMe | null>(null);

  useEffect(() => {
    const token = getAdvertiserAccessToken();
    if (!token) {
      router.replace("/advertise");
      return;
    }
    apiGet<AdvertiserMe>("/api/v1/advertisers/me", token)
      .then(setMe)
      .catch(() => {
        clearAdvertiserAccessToken();
        router.replace("/advertise");
      })
      .finally(() => setReady(true));
  }, [router]);

  function onLogout() {
    logoutAdvertiser();
    router.replace("/advertise");
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
      <header className="border-b border-slate-700/80 bg-ads-slate/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-ads-teal">AdsFind</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-white">{me?.business_name}</h1>
              {me ? (
                <span className={kycBadge(me.kyc_status)} title="Advertiser verification">
                  {kycLabel(me.kyc_status)}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-slate-400">{me?.email}</p>
            {me?.website_url ? (
              <a
                href={me.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-ads-teal hover:underline"
              >
                {me.website_url.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <Link href="/advertise" className="text-sm text-slate-400 hover:text-ads-teal">
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