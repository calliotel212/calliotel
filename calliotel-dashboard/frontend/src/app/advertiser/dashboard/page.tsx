"use client";

import { AdvertiserDashboardShell } from "@/components/advertiser-dashboard-shell";
import { AdsManagerPanel } from "@/components/ads/ads-manager-panel";
import { getAdvertiserAccessToken } from "@/lib/advertiser-auth";

export default function AdvertiserDashboardPage() {
  const token = getAdvertiserAccessToken();

  return (
    <AdvertiserDashboardShell>
      <AdsManagerPanel
        token={token}
        apiBase="/api/v1/advertisers"
        theme="dark"
        showTargeting
      />
    </AdvertiserDashboardShell>
  );
}