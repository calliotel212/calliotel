"use client";

import { FormEvent, useState } from "react";
import { APP_ADVERTISE_URL } from "@/lib/app-url";
import { getAuditApiUrl } from "@/lib/audit-api-url";
import type { WebsiteAuditResult } from "@/lib/audit-types";
import { AuditModal } from "@/components/audit-modal";

export function AuditStrategyWidget() {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WebsiteAuditResult | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const url = websiteUrl.trim();
    if (url.length < 4) return;

    setModalOpen(true);
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(getAuditApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website_url: url }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          body && typeof body === "object" && "detail" in body
            ? String((body as { detail: unknown }).detail)
            : `Audit failed (${res.status})`;
        throw new Error(message);
      }
      setResult(body as WebsiteAuditResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed");
    } finally {
      setLoading(false);
    }
  }

  function onCta() {
    window.location.href = APP_ADVERTISE_URL();
  }

  return (
  <section className="section-padding relative overflow-hidden border-y border-slate-800/60">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,229,255,0.08)_0%,_transparent_60%)]"
        aria-hidden
      />
      <div className="container-marketing relative">
        <div className="glass-card mx-auto max-w-3xl border-[#00E5FF]/20 p-8 shadow-glow-primary sm:p-10">
          <h2 className="text-center text-2xl font-bold text-white sm:text-3xl">Test Your AI Ad Strategy</h2>
          <p className="mt-3 text-center text-sm text-slate-400">
            Enter your website for a free SSL, keyword, and competitor audit — built for AI conversation ads.
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <label htmlFor="audit-website-url" className="sr-only">
              Website URL
            </label>
            <input
              id="audit-website-url"
              type="url"
              required
              placeholder="https://yourbusiness.com"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              className="min-h-12 flex-1 rounded-xl border border-slate-700 bg-[#0A0F1C]/80 px-4 py-3 text-base text-white placeholder:text-slate-500 backdrop-blur-sm focus:border-[#00E5FF]/60 focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/40"
            />
            <button
              type="submit"
              disabled={loading || websiteUrl.trim().length < 4}
              className="btn-primary-glow min-h-12 shrink-0 px-8 py-3 text-base disabled:opacity-60"
            >
              {loading ? "Analyzing…" : "Generate Premium Audit"}
            </button>
          </form>
        </div>
      </div>

      <AuditModal
        open={modalOpen}
        loading={loading}
        result={result}
        error={error}
        onClose={() => setModalOpen(false)}
        onCta={onCta}
      />
    </section>
  );
}