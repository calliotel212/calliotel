export type Campaign = {
  id: string;
  brand_name: string;
  max_cpc: string;
  daily_budget: string;
  target_countries: string[];
  target_languages: string[];
  status: string;
  ad_copy: string;
  destination_url: string;
  intent_description: string;
  clicks: number;
  review_ends_at?: string | null;
};

export type CampaignFormState = {
  brand_name: string;
  ad_copy: string;
  destination_url: string;
  intent_description: string;
  max_cpc: string;
  daily_budget: string;
  target_countries: string[];
  target_languages: string[];
};

export const emptyCampaignForm: CampaignFormState = {
  brand_name: "",
  ad_copy: "",
  destination_url: "",
  intent_description: "",
  max_cpc: "1.00",
  daily_budget: "25",
  target_countries: [],
  target_languages: [],
};

export const MENA_COUNTRIES: { code: string; name: string }[] = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "EG", name: "Egypt" },
  { code: "QA", name: "Qatar" },
  { code: "KW", name: "Kuwait" },
  { code: "BH", name: "Bahrain" },
  { code: "OM", name: "Oman" },
  { code: "JO", name: "Jordan" },
  { code: "LB", name: "Lebanon" },
  { code: "IQ", name: "Iraq" },
  { code: "MA", name: "Morocco" },
  { code: "DZ", name: "Algeria" },
  { code: "TN", name: "Tunisia" },
  { code: "YE", name: "Yemen" },
  { code: "PS", name: "Palestine" },
  { code: "LY", name: "Libya" },
  { code: "SD", name: "Sudan" },
];

export function reviewCountdown(endsAt: string | null | undefined): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt).getTime();
  const diff = end - Date.now();
  if (diff <= 0) return "Review completing soon";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return `${h}h ${m}m until auto-go-live`;
}

export function statusLabel(status: string): string {
  if (status === "pending_review" || status === "pending_approval") return "In review";
  if (status === "rejected") return "Rejected";
  if (status === "active") return "Active";
  if (status === "paused") return "Paused";
  return status;
}

export function targetingSummary(c: Campaign): string {
  const parts: string[] = [];
  if (c.target_countries?.length) {
    parts.push(c.target_countries.join(", "));
  } else {
    parts.push("All countries");
  }
  if (c.target_languages?.length) {
    parts.push(c.target_languages.map((l) => l.toUpperCase()).join(", "));
  } else {
    parts.push("All languages");
  }
  return parts.join(" · ");
}