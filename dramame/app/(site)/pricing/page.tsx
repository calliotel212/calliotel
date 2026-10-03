import type { Metadata } from "next";
import Link from "next/link";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Pricing" };

export default function PricingPage() {
  return (
    <main className="page">
      <p className="eyebrow">Plans</p>
      <h1>Finished videos, priced per video.</h1>
      <p className="lede">Each plan is a finished vertical video, or a series of them. Prices are in US dollars.</p>
      <p className="form-note" role="note">
        No checkout yet. Choosing a plan does not charge a card.
      </p>
      <div className="price-grid">
        {PLANS.map((plan) => (
          <article key={plan.id} className="price-card">
            <h2>{plan.name}</h2>
            <p className="price-amount">{plan.price}</p>
            <ul className="price-includes">
              {plan.includes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <Link className="button button-primary" href={`/signup?plan=${plan.id}`}>
              Choose {plan.name}
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
