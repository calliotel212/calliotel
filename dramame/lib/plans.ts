export const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    includes: ["An account", "The scroll-up preview", "One free episode per story"],
  },
  {
    id: "fan",
    name: "Fan",
    price: "$6/month",
    includes: ["Every episode of every story", "No ads", "Download for personal use"],
  },
  {
    id: "studio",
    name: "Studio",
    price: "$19/month",
    includes: ["Everything in Fan", "Early access to new stories", "Suggest a story with a guaranteed reply"],
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export function normalizePlan(value: string | null | undefined): PlanId | null {
  const id = value?.trim().toLowerCase();
  const match = PLANS.find((plan) => plan.id === id);
  return match ? match.id : null;
}
