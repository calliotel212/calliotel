"use client";

import type { WebsiteAuditResult } from "./audit-types";

type Props = {
  open: boolean;
  loading: boolean;
  result: WebsiteAuditResult | null;
  error: string | null;
  onClose: () => void;
  onCta: () => void;
};

export function AuditModal({ open, loading, result, error, onClose, onCta }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#00E5FF]/25 bg-[#0A0F1C]/95 p-6 shadow-2xl shadow-[#00E5FF]/10 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(10, 15, 28, 0.92)" }}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="audit-modal-title" className="text-lg font-semibold text-white">
            Free AI Website &amp; Competitor Audit
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-400 hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p className="mt-8 text-center text-sm text-[#00E5FF] animate-pulse">
            Analyzing your website and competitors...
          </p>
        ) : null}

        {error ? (
          <p className="mt-6 text-sm text-red-400">{error}</p>
        ) : null}

        {result && !loading ? (
          <div className="mt-6 space-y-6">
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                Site score
              </p>
              <p className="mt-2 text-6xl font-bold tabular-nums text-[#00E5FF]">{result.site_score}</p>
              <p className="mt-1 text-xs text-slate-500">out of 100</p>
            </div>

            <div className="flex justify-center gap-6 text-sm">
              <div>
                <span className="text-slate-500">SSL</span>
                <p
                  className={`font-semibold ${
                    result.ssl_status === "Valid" ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {result.ssl_status}
                </p>
              </div>
              {result.response_time_ms != null ? (
                <div>
                  <span className="text-slate-500">Response</span>
                  <p className="font-semibold text-slate-200">{result.response_time_ms} ms</p>
                </div>
              ) : null}
            </div>

            <section>
              <h3 className="text-sm font-semibold text-white">Missing keywords</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {result.missing_keywords.map((kw) => (
                  <li
                    key={kw}
                    className="rounded-full border border-slate-600/80 bg-slate-900/60 px-3 py-1 text-xs text-slate-300"
                  >
                    {kw}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-white">Competitor insights</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{result.competitor_insights}</p>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-white">Ad recommendations</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-300">
                {result.ad_recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}

        {!loading && result ? (
          <div className="mt-8 border-t border-slate-700/80 pt-6">
            <p className="text-center text-sm text-slate-400">
              Ready to beat your competitors? Create your first ad campaign now.
            </p>
            <button
              type="button"
              onClick={onCta}
              className="mt-4 w-full rounded-lg bg-[#00E5FF] py-2.5 text-sm font-semibold text-[#0A0F1C] hover:brightness-110"
            >
              Create advertiser account
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}