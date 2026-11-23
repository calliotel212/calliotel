"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { PublisherDashboardShell } from "@/components/publisher-dashboard-shell";
import { apiGet, apiPost } from "@/lib/api-client";
import {
  getPublisherAccessToken,
  getPublisherApiKey,
  savePublisherApiKey,
} from "@/lib/publisher-auth";

type Me = {
  pending_balance: string;
  paid_balance: string;
  total_clicks: number;
  active_api_keys: number;
  api_key_masked: string;
};

function formatUsd(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [text]);
  return (
    <button
      type="button"
      onClick={onCopy}
      className="rounded-md border border-slate-600 px-2 py-1 text-xs text-slate-200 hover:border-ads-teal hover:text-ads-teal"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function PublisherDashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [rotateMsg, setRotateMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const token = getPublisherAccessToken();
    if (!token) return;
    apiGet<Me>("/api/v1/publishers/me", token).then(setMe);
    setApiKey(getPublisherApiKey());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onRotateKey() {
    const token = getPublisherAccessToken();
    if (!token) return;
    setRotateMsg(null);
    try {
      const data = await apiPost<{ api_key: string; api_key_masked: string }>(
        "/api/v1/publishers/keys/rotate",
        {},
        token
      );
      savePublisherApiKey(data.api_key);
      setApiKey(data.api_key);
      setRotateMsg(`New key active (${data.api_key_masked}). Previous key is invalid.`);
      load();
    } catch (err) {
      setRotateMsg(err instanceof Error ? err.message : "Rotation failed");
    }
  }

  const baseUrl =
    (typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "http://localhost:8000"
    ).replace(/\/$/, "");

  const keyForSnippet = apiKey ?? "YOUR_PUBLISHER_API_KEY";

  const pythonSnippet = `import os
import httpx

API_KEY = os.environ.get("PUBLISHER_API_KEY", "${keyForSnippet}")
url = "${baseUrl}/api/v1/internal/ads/match"
headers = {"X-Publisher-Api-Key": API_KEY}
params = {"q": "car rental near airport", "country": "AE", "language": "en"}

with httpx.Client(timeout=3.0) as client:
    r = client.get(url, params=params, headers=headers)
    print(r.json())`;

  const jsSnippet = `const apiKey = process.env.PUBLISHER_API_KEY ?? "${keyForSnippet}";
const url = new URL("${baseUrl}/api/v1/internal/ads/match");
url.searchParams.set("q", "car rental near airport");
url.searchParams.set("country", "AE");
url.searchParams.set("language", "en");

const res = await fetch(url, {
  headers: { "X-Publisher-Api-Key": apiKey },
});
console.log(await res.json());`;

  return (
    <PublisherDashboardShell>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Pending balance" value={me ? formatUsd(me.pending_balance) : "—"} />
        <StatCard title="Total clicks" value={me ? String(me.total_clicks) : "—"} />
        <StatCard
          title="Active API keys"
          value={me ? String(me.active_api_keys) : "—"}
          hint={me?.api_key_masked}
        />
      </div>

      <section className="mt-10 rounded-xl border border-slate-700 bg-ads-slate p-6">
        <SectionHeader
          title="API key"
          action={
            <button
              type="button"
              onClick={onRotateKey}
              className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-ads-teal hover:text-ads-teal"
            >
              Rotate key
            </button>
          }
        />
        {apiKey ? (
          <p className="mt-2 break-all font-mono text-sm text-ads-teal">{apiKey}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-400">
            Raw key is shown once at signup or after rotation. Masked: {me?.api_key_masked ?? "—"}
          </p>
        )}
        {rotateMsg ? <p className="mt-2 text-sm text-amber-300">{rotateMsg}</p> : null}
      </section>

      <section className="mt-8 rounded-xl border border-slate-700 bg-ads-slate p-6">
        <h2 className="text-lg font-semibold text-white">Integration docs</h2>
        <p className="mt-1 text-sm text-slate-400">
          Send <code className="text-ads-teal">X-Publisher-Api-Key</code> on every match request.
        </p>

        <div className="mt-6">
          <SectionHeader
            title="Python"
            action={apiKey ? <CopyButton text={pythonSnippet} /> : null}
          />
          <pre className="mt-2 overflow-x-auto rounded-lg bg-ads-navy p-4 text-xs text-slate-300">
            {pythonSnippet}
          </pre>
        </div>

        <div className="mt-6">
          <SectionHeader title="JavaScript" action={apiKey ? <CopyButton text={jsSnippet} /> : null} />
          <pre className="mt-2 overflow-x-auto rounded-lg bg-ads-navy p-4 text-xs text-slate-300">
            {jsSnippet}
          </pre>
        </div>
      </section>
    </PublisherDashboardShell>
  );
}

function StatCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-ads-slate p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">Key: {hint}</p> : null}
    </div>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      {action}
    </div>
  );
}