import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pricing" };

const TIERS = [
  {
    name: "Look around",
    amount: "Draft $0",
    detail: "An account and the placeholder scroll preview. This is not a charge.",
  },
  {
    name: "One story",
    amount: "Draft $6",
    detail: "A draft amount for a finished story of 60–75 episodes. Not for sale.",
  },
  {
    name: "A longer stay",
    amount: "Draft $12",
    detail: "A draft amount for more than one story. Not for sale.",
  },
];

export default function PricingPage() {
  return (
    <main className="page">
      <p className="eyebrow">Pricing</p>
      <h1>Draft amounts only.</h1>
      <p className="lede">
        These figures are a layout draft. Drama Me does not charge a card, sell coins, or lock episodes behind payment.
      </p>
      <div className="price-grid">
        {TIERS.map((tier) => (
          <article key={tier.name} className="price-card">
            <p className="draft-tag">Draft</p>
            <h2>{tier.name}</h2>
            <p className="price-amount">{tier.amount}</p>
            <p>{tier.detail}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
