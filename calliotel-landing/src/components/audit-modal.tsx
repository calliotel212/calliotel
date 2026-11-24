"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";
import type { WebsiteAuditResult } from "@/lib/audit-types";

const LOADING_MESSAGES = [
  "Scanning Website…",
  "Analyzing Competitors…",
  "Generating Ad Strategy…",
] as const;

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
    <div className="relative mx-auto h-44 w-44 shrink-0 lg:h-52 lg:w-52">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="72%"
          outerRadius="100%"
          barSize={14}
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
        <span className="text-4xl font-bold tabular-nums text-[#00E5FF] lg:text-5xl">{score}</span>
        <span className="text-[10px] uppercase tracking-widest text-slate-500">overall score</span>
      </div>
    </div>
  );
}

function trafficBadgeClass(level: string) {
  if (level === "High") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
  if (level === "Medium") return "border-amber-500/40 bg-amber-500/10 text-amber-200";
  return "border-slate-500/50 bg-slate-800/60 text-slate-300";
}

export function AuditModal({ open, loading, result, error, onClose, onCta }: Props) {
  const [loadingIndex, setLoadingIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setLoadingIndex(0);
      return;
    }
    const id = window.setInterval(() => {
      setLoadingIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => window.clearInterval(id);
  }, [loading]);

  if (!open) return null;

  const score = result?.overall_score ?? result?.site_score ?? 0;

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
        className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[#00E5FF]/25 bg-[#0A0F1C]/95 p-6 shadow-2xl shadow-[#00E5FF]/10 backdrop-blur-xl lg:p-8"
        style={{ backgroundColor: "rgba(10, 15, 28, 0.92)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#00E5FF]/80">
              BuyerBlueprint · Nexora intelligence
            </p>
            <h2 id="audit-modal-title" className="mt-1 text-xl font-semibold text-white lg:text-2xl">
              Premium Website &amp; Competitor Audit
            </h2>
          </div>
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
          <p className="mt-12 text-center text-sm font-medium text-[#00E5FF] animate-pulse">
            {LOADING_MESSAGES[loadingIndex]}
          </p>
        ) : null}

        {error ? <p className="mt-6 text-sm text-red-400">{error}</p> : null}

        {result && !loading ? (
          <div className="mt-6 space-y-8">
            <div className="grid gap-6 lg:grid-cols-[auto_1fr] lg:items-center">
              <ScoreRing score={score} />
              <GlassCard title="Traffic estimate">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wider ${trafficBadgeClass(
                      result.traffic_estimate.level,
                    )}`}
                  >
                    {result.traffic_estimate.level}
                  </span>
                  {result.ssl_status ? (
                    <span className="text-xs text-slate-500">
                      SSL {result.ssl_status}
                      {result.response_time_ms != null ? ` · ${result.response_time_ms} ms` : ""}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.traffic_estimate.reason}</p>
              </GlassCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <GlassCard title="SEO health">
                <div className="mb-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Score</span>
                    <span className="font-semibold text-[#00E5FF]">{result.seo_health.score}/100</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#00E5FF]/80 to-[#00E5FF]"
                      style={{ width: `${Math.min(100, result.seo_health.score)}%` }}
                    />
                  </div>
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Quick wins</p>
                <ul className="mt-2 space-y-2">
                  {result.seo_health.quick_wins.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-slate-200">
                      <span className="text-emerald-400" aria-hidden>
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-slate-500">Issues</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-400">
                  {result.seo_health.issues.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </GlassCard>

              <div className="space-y-6">
                <GlassCard title="Competitor insights">
                  <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
                    {result.competitor_insights.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00E5FF]" aria-hidden />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
                <GlassCard title="Missing keywords">
                  <ul className="flex flex-wrap gap-2">
                    {result.missing_keywords.map((kw) => (
                      <li
                        key={kw}
                        className="rounded-full border border-[#00E5FF]/35 bg-[#00E5FF]/10 px-3 py-1 text-xs font-medium text-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.15)]"
                      >
                        {kw}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </div>
            </div>

            <GlassCard title="AI ad recommendations">
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-200">
                {(result.ai_ad_recommendations.length
                  ? result.ai_ad_recommendations
                  : result.ad_recommendations
                ).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </GlassCard>
          </div>
        ) : null}

        {!loading && result ? (
          <div className="mt-8 border-t border-slate-700/80 pt-6">
            <button
              type="button"
              onClick={onCta}
              className="w-full rounded-lg bg-[#00E5FF] py-3.5 text-sm font-semibold text-[#0A0F1C] shadow-lg shadow-[#00E5FF]/25 hover:brightness-110 lg:text-base"
            >
              Claim Your Free $50 Ad Credit &amp; Start Beating Your Competitors Now
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GlassCard({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 backdrop-blur-md lg:p-5 ${className}`}
    >
      {title ? (
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-white">{title}</h3>
      ) : null}
      {children}
    </div>
  );
}