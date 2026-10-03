export const PLANS = [
  {
    id: "single",
    name: "Single video",
    price: "$10",
    includes: ["One finished 60–75 second vertical video, ready to post."],
  },
  {
    id: "two",
    name: "Two videos",
    price: "$19",
    includes: ["Two finished videos.", "Save $1."],
  },
  {
    id: "series10",
    name: "Series of 10",
    price: "$99",
    includes: ["Ten finished videos with the same characters and wardrobe across all ten."],
  },
  {
    id: "custom",
    name: "Custom series",
    price: "from $499",
    includes: ["A full 60–75 episode series, quote by email."],
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export function normalizePlan(value: string | null | undefined): PlanId | null {
  const id = value?.trim().toLowerCase();
  const match = PLANS.find((plan) => plan.id === id);
  return match ? match.id : null;
}

export function planLabel(id: string | null | undefined): string {
  const match = PLANS.find((plan) => plan.id === id);
  return match?.name ?? (id?.trim() || "Plan");
}
