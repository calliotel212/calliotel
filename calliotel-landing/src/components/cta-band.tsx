const SIGNUP_URL = "https://app.calliotel.ai/signup";

export function CtaBand() {
  return (
    <section className="section-padding">
      <div className="container-marketing">
        <div className="rounded-2xl border border-accent-500/30 bg-gradient-to-br from-accent-600/20 to-navy-800/80 px-6 py-12 text-center sm:px-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to answer every call?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-slate-300">
            Join MENA businesses using Calliotel to capture leads and book appointments around the clock.
          </p>
          <a
            href={SIGNUP_URL}
            className="mt-8 inline-block rounded-lg bg-accent-500 px-8 py-3 text-base font-semibold text-navy-950 transition hover:bg-accent-400"
          >
            Get started
          </a>
        </div>
      </div>
    </section>
  );
}
