import { APP_ADVERTISE_URL, APP_PUBLISHERS_URL } from "@/lib/app-url";

const plans = [
  {
    name: "Advertisers",
    price: "PPC",
    detail: "$50 minimum deposit",
    description: "Pay only for clicks on sponsored offers inside AI conversations.",
    features: [
      "Keyword & geo targeting",
      "48-hour campaign review",
      "Real-time spend controls",
      "Conversion-ready landing URLs",
    ],
    cta: "Start Advertising",
    href: APP_ADVERTISE_URL(),
    highlighted: true,
  },
  {
    name: "Publishers",
    price: "Free",
    detail: "70% revenue share",
    description: "Integrate once and earn on qualified clicks from your AI traffic.",
    features: [
      "REST API & docs",
      "Native sponsored cards",
      "No minimum traffic",
      "Transparent reporting",
    ],
    cta: "Join as Publisher",
    href: APP_PUBLISHERS_URL(),
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="section-padding border-t border-slate-800 bg-slate-800/10">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Pricing</h2>
          <p className="mt-3 text-slate-300">Simple models built for scale on both sides of the network.</p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`glass-card flex flex-col p-8 ${
                plan.highlighted ? "ring-1 ring-adsfind-primary/30 shadow-glow-primary" : ""
              }`}
            >
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-4 flex flex-wrap items-baseline gap-2">
                <span className="text-4xl font-bold text-adsfind-primary">{plan.price}</span>
                <span className="text-sm text-slate-300">{plan.detail}</span>
              </p>
              <p className="mt-3 text-sm text-slate-300">{plan.description}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-adsfind-primary" aria-hidden>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                className={
                  plan.highlighted
                    ? "btn-primary-glow mt-8 block py-3 text-center"
                    : "mt-8 block rounded-lg border border-slate-700 py-3 text-center text-sm font-semibold text-white transition hover:border-adsfind-primary/50"
                }
              >
                {plan.cta}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}