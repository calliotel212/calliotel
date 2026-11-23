"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { saveAdvertiserAccessToken } from "@/lib/advertiser-auth";

type Tab = "signup" | "login";

function VoiceSearchPreview() {
  return (
    <div className="mt-8 rounded-xl border border-slate-700 bg-ads-slate p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
        Live in AI search &amp; voice
      </p>
      <div className="mr-auto mt-3 max-w-[85%] rounded-2xl rounded-bl-md bg-ads-navy px-4 py-3 text-sm text-slate-200 shadow-inner">
        Where can I rent a car near the airport in Dubai?
      </div>
      <div className="mt-3 flex justify-end">
        <div className="max-w-[90%] rounded-2xl rounded-br-md border border-ads-teal/30 bg-gradient-to-br from-slate-800 to-ads-slate px-4 py-3 shadow-lg">
          <span className="mb-1 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">
            Sponsored
          </span>
          <p className="text-sm font-semibold text-white">Gulf Drive Rentals</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-300">
            Airport pickup in 15 minutes. Book online and skip the counter — rates from $29/day.
          </p>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-500">
        Sample placement when users ask Calliotel AI assistants
      </p>
    </div>
  );
}

export default function AdvertisePage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path =
        tab === "signup" ? "/api/v1/advertisers/register" : "/api/v1/advertisers/login";
      const body =
        tab === "signup"
          ? { email, password, business_name: businessName || undefined }
          : { email, password };
      const data = await apiPost<{ access_token: string }>(path, body);
      saveAdvertiserAccessToken(data.access_token);
      router.push("/advertiser/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ads-navy text-slate-100">
      <div className="mx-auto max-w-lg px-4 py-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-ads-teal">
          AdsFind on Calliotel
        </p>
        <h1 className="mt-3 text-center text-3xl font-bold leading-tight text-white">
          Put Your Business Inside the AI Conversation.
        </h1>
        <p className="mt-4 text-center text-sm text-slate-400">
          Deposit $100 to start getting AI-referred customers.
        </p>

        <VoiceSearchPreview />

        <div className="mt-10 flex rounded-lg bg-ads-slate p-1">
          {(["signup", "login"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-2 text-sm font-medium ${
                tab === t ? "bg-ads-teal text-ads-navy" : "text-slate-400 hover:text-white"
              }`}
            >
              {t === "signup" ? "Sign up" : "Log in"}
            </button>
          ))}
        </div>

        <form className="mt-6 space-y-4 rounded-xl border border-slate-700 bg-ads-slate p-6" onSubmit={onSubmit}>
          {tab === "signup" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="business">
                Business name
              </label>
              <input
                id="business"
                type="text"
                className="w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white focus:border-ads-teal focus:outline-none focus:ring-1 focus:ring-ads-teal"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Plumbing"
              />
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              className="w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white focus:border-ads-teal focus:outline-none focus:ring-1 focus:ring-ads-teal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white focus:border-ads-teal focus:outline-none focus:ring-1 focus:ring-ads-teal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-ads-teal py-2.5 text-sm font-semibold text-ads-navy hover:bg-ads-teal-dark disabled:opacity-60"
          >
            {loading ? "Please wait…" : tab === "signup" ? "Create advertiser account" : "Log in"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-500">
          Running a Calliotel AI agent?{" "}
          <Link href="/login" className="text-ads-teal hover:underline">
            Tenant dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}