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
        dark ? "border-slate-700" : "border-slate-200 bg-white shadow-sm"
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
                className={dark ? "border-t border-slate-800" : "border-t border-slate-100"}
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
          className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
            c.status === "rejected"
              ? "bg-red-900/40 text-red-200"
              : "bg-amber-900/40 text-amber-200"
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

  if (!onToggle) {
    return (
      <span
        className={`rounded-full px-3 py-1 text-xs font-medium ${
          c.status === "active"
            ? dark
              ? "bg-teal-900/50 text-ads-teal"
              : "bg-emerald-100 text-emerald-800"
            : dark
              ? "bg-slate-800 text-slate-400"
              : "bg-slate-100 text-slate-600"
        }`}
      >
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
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        c.status === "active"
          ? "bg-teal-900/50 text-ads-teal hover:bg-teal-900/70"
          : dark
            ? "bg-slate-800 text-slate-400 hover:bg-slate-700"
            : "bg-slate-200 text-slate-600 hover:bg-slate-300"
      }`}
    >
      {statusLabel(c.status)}
    </button>
  );
}