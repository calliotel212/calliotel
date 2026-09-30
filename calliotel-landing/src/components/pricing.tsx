const SIGNUP_URL = "https://app.calliotel.ai/signup";

const plans = [
  {
    name: "Starter",
    price: "$300",
    period: "/mo",
    description: "For small teams getting started with AI call handling.",
    features: ["1 AI agent", "Arabic + English", "Call summaries", "Email support"],
    highlighted: false,
    cta: "Get started",
    custom: false,
  },
  {
    name: "Pro",
    price: "$500",
    period: "/mo",
    description: "Growing businesses that need more volume and integrations.",
    features: [
      "3 AI agents",
      "Appointment booking",
      "CRM webhooks",
      "Priority support",
    ],
    highlighted: true,
    cta: "Get started",
    custom: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Dedicated numbers, SLAs, and custom workflows at scale.",
    features: ["Unlimited agents", "Dedicated account manager", "Custom voices", "On-prem options"],
    highlighted: false,
    cta: "Contact sales",
    custom: true,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="section-padding">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Simple pricing</h2>
          <p className="mt-3 text-slate-400">Plans that scale with your call volume.</p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-8 ${
                plan.highlighted
                  ? "border-accent-500/60 bg-navy-800/80 shadow-lg shadow-accent-500/10"
                  : "border-slate-700/80 bg-navy-900/40"
              }`}
            >
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">{plan.price}</span>
                {plan.period ? (
                  <span className="text-slate-400">{plan.period}</span>
                ) : null}
              </p>
              <p className="mt-3 text-sm text-slate-400">{plan.description}</p>
              <ul className="mt-6 flex-1 space-y-3 text-sm text-slate-300">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-accent-400" aria-hidden>
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <a
                href={plan.custom ? "mailto:sales@calliotel.ai" : SIGNUP_URL}
                className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition ${
                  plan.highlighted
                    ? "bg-accent-500 text-navy-950 hover:bg-accent-400"
                    : "border border-slate-600 text-white hover:border-accent-500/50"
                }`}
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
