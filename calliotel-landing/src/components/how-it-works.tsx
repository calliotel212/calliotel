const steps = [
  {
    step: "1",
    title: "Sign up",
    description: "Create your account in minutes. No credit card required to explore the dashboard.",
  },
  {
    step: "2",
    title: "Setup",
    description: "Configure your AI agent, business hours, scripts, and phone number routing.",
  },
  {
    step: "3",
    title: "Live",
    description: "Go live — every call answered in Arabic and English, 24/7.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-padding bg-navy-900/50">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">How it works</h2>
          <p className="mt-3 text-slate-400">From signup to answered calls in three steps.</p>
        </div>
        <ol className="mt-12 grid gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <li
              key={item.step}
              className="relative rounded-2xl border border-slate-700/80 bg-navy-950/50 p-6"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-500/20 text-sm font-bold text-accent-400">
                {item.step}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
