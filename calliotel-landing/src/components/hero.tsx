const SIGNUP_URL = "https://app.calliotel.ai/signup";

export function Hero() {
  return (
    <section className="section-padding relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-600/20 via-transparent to-transparent"
        aria-hidden
      />
      <div className="container-marketing relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-block rounded-full border border-accent-500/30 bg-accent-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-accent-400">
            MENA · Arabic & English
          </p>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Never Miss Another Customer Call. AI Phone Agents for MENA Businesses.
          </h1>
          <p className="mt-6 text-pretty text-lg text-slate-300 sm:text-xl">
            Arabic + English AI receptionists that answer 24/7, book appointments, and never sleep.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href={SIGNUP_URL}
              className="w-full rounded-lg bg-accent-500 px-8 py-3 text-center text-base font-semibold text-navy-950 transition hover:bg-accent-400 sm:w-auto"
            >
              Start free trial
            </a>
            <a
              href="#demo"
              className="w-full rounded-lg border border-slate-600 px-8 py-3 text-center text-base font-medium text-slate-200 transition hover:border-accent-500/50 hover:text-white sm:w-auto"
            >
              See demo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
