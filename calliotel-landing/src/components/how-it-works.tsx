import { APP_ADVERTISE_URL, APP_PUBLISHERS_URL } from "@/lib/app-url";

const advertiserSteps = [
  {
    step: "1",
    title: "Create campaign",
    description:
      "Define keywords, geos, and daily budget. Upload creative and landing URLs in the AdsFind wizard.",
  },
  {
    step: "2",
    title: "Pass review",
    description:
      "Campaigns are reviewed for policy compliance within 48 hours before going live on the network.",
  },
  {
    step: "3",
    title: "Pay per click",
    description:
      "Only pay when users engage with your offer inside an AI conversation. $50 minimum deposit to start.",
  },
];

const publisherSteps = [
  {
    step: "1",
    title: "Get your API key",
    description:
      "Sign up free, integrate the AdsFind matcher into your chatbot, voice agent, or AI app.",
  },
  {
    step: "2",
    title: "Serve native ads",
    description:
      "Intent signals from user messages trigger relevant sponsored cards — no banners, no friction.",
  },
  {
    step: "3",
    title: "Earn 70% revenue",
    description:
      "Transparent revenue share on every qualified click. Payouts align with your traffic volume.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="section-padding">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">How it works</h2>
          <p className="mt-3 text-slate-300">
            Two sides of one network — advertisers buy intent, publishers monetize AI traffic.
          </p>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <Column
            id="advertisers"
            title="For Advertisers"
            subtitle="Reach buyers at the moment of intent"
            steps={advertiserSteps}
            ctaLabel="Start Advertising"
            ctaHref={APP_ADVERTISE_URL()}
          />
          <Column
            id="publishers"
            title="For Publishers"
            subtitle="Monetize without breaking the UX"
            steps={publisherSteps}
            ctaLabel="Join as Publisher"
            ctaHref={APP_PUBLISHERS_URL()}
            badge="70% rev share"
          />
        </div>
      </div>
    </section>
  );
}

function Column({
  id,
  title,
  subtitle,
  steps,
  ctaLabel,
  ctaHref,
  badge,
}: {
  id: string;
  title: string;
  subtitle: string;
  steps: typeof advertiserSteps;
  ctaLabel: string;
  ctaHref: string;
  badge?: string;
}) {
  return (
    <div id={id} className="glass-card scroll-mt-24 p-6 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-xl font-semibold text-white">{title}</h3>
        {badge ? (
          <span className="rounded-full border border-adsfind-primary/40 bg-adsfind-primary/10 px-2.5 py-0.5 text-xs font-medium text-adsfind-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
      <ol className="mt-8 space-y-6">
        {steps.map((item) => (
          <li key={item.step} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 text-sm font-bold text-adsfind-primary">
              {item.step}
            </span>
            <div>
              <h4 className="font-semibold text-white">{item.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">{item.description}</p>
            </div>
          </li>
        ))}
      </ol>
      <a
        href={ctaHref}
        className="mt-8 inline-flex rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-medium text-white transition hover:border-adsfind-primary/60 hover:text-adsfind-primary"
      >
        {ctaLabel}
      </a>
    </div>
  );
}