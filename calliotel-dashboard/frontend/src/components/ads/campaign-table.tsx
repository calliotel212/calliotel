"use client";

import {
  type Campaign,
  reviewCountdown,
  statusLabel,
  targetingSummary,
} from "@/lib/campaign-types";

type Props = {
  campaigns: Campaign[];
  theme?: "dark" | "light";
  showTargeting?: boolean;
  onToggleStatus?: (campaign: Campaign) => void;
};

export function CampaignTable({
  campaigns,
  theme = "dark",
  showTargeting = true,
  onToggleStatus,
}: Props) {
  const dark = theme === "dark";
  return (
    <div
      className={`overflow-x-auto rounded-xl border ${
        dark ? "glass-panel border-slate-700/80" : "border-slate-200 bg-white shadow-sm"
      }`}
    >
      <table className="min-w-full text-left text-sm">
        <thead
          className={`border-b text-xs uppercase ${
            dark
              ? "border-slate-700 bg-ads-slate text-slate-400"
              : "border-slate-200 bg-slate-50 text-slate-500"
          }`}
        >
          <tr>
            <th className="px-4 py-3 font-medium">Campaign</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Budget</th>
            <th className="px-4 py-3 font-medium">CPC</th>
            {showTargeting ? <th className="px-4 py-3 font-medium">Targeting</th> : null}
            <th className="px-4 py-3 font-medium">Clicks</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td
                colSpan={showTargeting ? 6 : 5}
                className={`px-4 py-8 text-center ${dark ? "text-slate-500" : "text-slate-400"}`}
              >
                No campaigns yet. Create one to appear in AI conversations.
              </td>
            </tr>
          ) : (
            campaigns.map((c) => (
              <tr
                key={c.id}
                className={
                  dark
                    ? "border-t border-slate-800/80 transition hover:bg-slate-800/30"
                    : "border-t border-slate-100 hover:bg-slate-50"
                }
              >
                <td className={`px-4 py-3 font-medium ${dark ? "text-white" : "text-slate-900"}`}>
                  {c.brand_name}
                </td>
                <td className="px-4 py-3">
                  <CampaignStatusCell campaign={c} dark={dark} onToggle={onToggleStatus} />
                </td>
                <td className={`px-4 py-3 ${dark ? "text-slate-300" : "text-slate-600"}`}>
                  ${Number(c.daily_budget || 0).toFixed(2)}/day
                </td>
                <td className={`px-4 py-3 ${dark ? "text-slate-300" : "text-slate-600"}`}>
                  ${c.max_cpc}
                </td>
                {showTargeting ? (
                  <td
                    className={`max-w-[12rem] truncate px-4 py-3 ${dark ? "text-slate-400" : "text-slate-500"}`}
                    title={targetingSummary(c)}
                  >
                    {targetingSummary(c)}
                  </td>
                ) : null}
                <td className={`px-4 py-3 ${dark ? "text-slate-300" : "text-slate-600"}`}>
                  {c.clicks ?? 0}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function CampaignStatusCell({
  campaign: c,
  dark,
  onToggle,
}: {
  campaign: Campaign;
  dark: boolean;
  onToggle?: (c: Campaign) => void;
}) {
  const pending =
    c.status === "pending_review" || c.status === "pending_approval" || c.status === "rejected";

  if (pending) {
    return (
      <hgroup className="space-y-1">
        <span
          className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            c.status === "rejected"
              ? "bg-red-500/15 text-red-300 ring-red-500/40"
              : "bg-amber-500/15 text-amber-200 ring-amber-500/40"
          }`}
        >
          {statusLabel(c.status)}
        </span>
        {c.status !== "rejected" && reviewCountdown(c.review_ends_at) ? (
          <p className="text-[10px] text-amber-200/80">{reviewCountdown(c.review_ends_at)}</p>
        ) : null}
      </hgroup>
    );
  }

  const badgeClass = statusBadgeClass(c.status, dark);

  if (!onToggle) {
    return (
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${badgeClass}`}>
        {statusLabel(c.status)}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={c.status === "active"}
      onClick={() => onToggle(c)}
      className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 transition ${badgeClass} ${
        c.status === "active" ? "hover:brightness-110" : "hover:opacity-90"
      }`}
    >
      {statusLabel(c.status)}
    </button>
  );
}

function statusBadgeClass(status: string, dark: boolean): string {
  if (status === "active") {
    return "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40";
  }
  if (status === "paused") {
    return "bg-red-500/15 text-red-300 ring-red-500/40";
  }
  if (status === "pending_review" || status === "pending_approval") {
    return "bg-amber-500/15 text-amber-200 ring-amber-500/40";
  }
  if (status === "rejected") {
    return "bg-red-500/15 text-red-300 ring-red-500/40";
  }
  return dark ? "bg-slate-800 text-slate-400 ring-slate-600/40" : "bg-slate-100 text-slate-600 ring-slate-200";
}