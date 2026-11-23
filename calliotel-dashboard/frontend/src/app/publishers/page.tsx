"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { savePublisherAccessToken, savePublisherApiKey } from "@/lib/publisher-auth";

type Tab = "signup" | "login";

const STEPS = [
  {
    title: "Join as a publisher",
    body: "Create an account and receive your AdsFind API key instantly.",
  },
  {
    title: "Integrate your AI product",
    body: "Send the API key on each ad match request from your agent or app.",
  },
  {
    title: "Earn 70% revenue share",
    body: "When a sponsored ad serves in your experience, you accrue pending balance.",
  },
];

export default function PublishersPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path =
        tab === "signup" ? "/api/v1/publishers/register" : "/api/v1/publishers/login";
      const body =
        tab === "signup"
          ? { email, password, name: name || undefined }
          : { email, password };
      const data = await apiPost<{ access_token: string; api_key?: string }>(path, body);
      savePublisherAccessToken(data.access_token);
      if (data.api_key) {
        savePublisherApiKey(data.api_key);
      }
      router.push("/publisher/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ads-navy text-slate-100">
      <div className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-center text-xs font-semibold uppercase tracking-widest text-ads-teal">
          AdsFind Publisher Network
        </p>
        <h1 className="mt-3 text-center text-3xl font-bold leading-tight text-white">
          Monetize Your AI. Keep 70% of Ad Revenue.
        </h1>
        <p className="mt-4 text-center text-sm text-slate-400">
          Plug sponsored ads into voice agents and conversational search — payout accrues on every
          served impression.
        </p>

        <ol className="mt-10 space-y-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-xl border border-slate-700 bg-ads-slate p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ads-teal text-sm font-bold text-ads-navy">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-white">{step.title}</p>
                <p className="mt-1 text-sm text-slate-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

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
              {t === "signup" ? "Join as publisher" : "Log in"}
            </button>
          ))}
        </div>

        <form className="mt-6 space-y-4 rounded-xl border border-slate-700 bg-ads-slate p-6" onSubmit={onSubmit}>
          {tab === "signup" ? (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300" htmlFor="name">
                Publisher / product name
              </label>
              <input
                id="name"
                type="text"
                className="w-full rounded-lg border border-slate-600 bg-ads-navy px-3 py-2 text-sm text-white focus:border-ads-teal focus:outline-none focus:ring-1 focus:ring-ads-teal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Voice Assistant"
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
            {loading ? "Please wait…" : tab === "signup" ? "Create publisher account" : "Log in"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-slate-500">
          Running ad campaigns instead?{" "}
          <Link href="/advertise" className="text-ads-teal hover:underline">
            Advertiser dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}