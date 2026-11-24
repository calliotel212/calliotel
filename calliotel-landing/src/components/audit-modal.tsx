"use client";

import type { ReactNode } from "react";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import type { WebsiteAuditResult } from "@/lib/audit-types";

type Props = {
  open: boolean;
  loading: boolean;
  result: WebsiteAuditResult | null;
  error: string | null;
  onClose: () => void;
  onCta: () => void;
};

function ScoreRing({ score }: { score: number }) {
  const data = [{ name: "score", value: score, fill: "#00E5FF" }];
  return (
    <div className="relative mx-auto h-40 w-40">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="72%"
          outerRadius="100%"
          barSize={10}
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            background={{ fill: "rgba(148, 163, 184, 0.15)" }}
            dataKey="value"
            cornerRadius={6}
            max={100}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold tabular-nums text-[#00E5FF]">{score}</span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">out of 100</span>
      </div>
    </div>
  );
}

export function AuditModal({ open, loading, result, error, onClose, onCta }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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

        {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}

        {result && !loading ? (
          <div className="mt-6 space-y-6">
            <GlassCard>
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
                Site score
              </p>
              <ScoreRing score={result.site_score} />
            </GlassCard>

            <GlassCard title="SSL status">
              <p
                className={`text-lg font-semibold ${
                  result.ssl_status === "Valid" ? "text-emerald-400" : "text-amber-400"
                }`}
              >
                {result.ssl_status}
              </p>
              {result.response_time_ms != null ? (
                <p className="mt-1 text-xs text-slate-500">Response {result.response_time_ms} ms</p>
              ) : null}
            </GlassCard>

            <GlassCard title="Missing keywords">
              <ul className="flex flex-wrap gap-2">
                {result.missing_keywords.map((kw) => (
                  <li
                    key={kw}
                    className="rounded-full border border-slate-600/80 bg-slate-900/60 px-3 py-1 text-xs text-slate-300"
                  >
                    {kw}
                  </li>
                ))}
              </ul>
            </GlassCard>

            <GlassCard title="Competitor insights">
              <p className="text-sm leading-relaxed text-slate-300">{result.competitor_insights}</p>
            </GlassCard>
          </div>
        ) : null}

        {!loading && result ? (
          <div className="mt-8 border-t border-slate-700/80 pt-6">
            <p className="text-center text-sm text-slate-400">
              Ready to fix this? Start advertising on the AdsFind network.
            </p>
            <button
              type="button"
              onClick={onCta}
              className="mt-4 w-full rounded-lg bg-[#00E5FF] py-2.5 text-sm font-semibold text-[#0A0F1C] hover:brightness-110"
            >
              Ready to fix this? Start Advertising →
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GlassCard({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-md">
      {title ? <h3 className="mb-2 text-sm font-semibold text-white">{title}</h3> : null}
      {children}
    </div>
  );
}