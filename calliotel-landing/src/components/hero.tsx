import { APP_ADVERTISE_URL, APP_PUBLISHERS_URL } from "@/lib/app-url";

export function Hero() {
  const advertiseUrl = APP_ADVERTISE_URL();
  const publishersUrl = APP_PUBLISHERS_URL();

  return (
    <section className="section-padding relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(0,229,255,0.15)_0%,_transparent_55%)]"
        aria-hidden
      />
      <div className="container-marketing relative">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-800/50 px-4 py-1.5 text-xs font-medium text-adsfind-primary backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-adsfind-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-adsfind-primary" />
            </span>
            The AI Ad Network is Live
          </p>
          <h1 className="text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-6xl">
            Monetize the AI Conversation.
          </h1>
          <p className="mt-6 text-pretty text-lg text-slate-300 sm:text-xl">
            AdsFind is the enterprise AI advertising network that places sponsored offers inside
            high-intent AI chats and voice agents — with transparent PPC billing and publisher
            revenue share.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a href={advertiseUrl} className="btn-primary-glow w-full px-8 py-3 text-center sm:w-auto">
              Advertise
            </a>
            <a
              href={publishersUrl}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-8 py-3 text-center text-base font-medium text-slate-300 backdrop-blur-sm transition hover:border-adsfind-primary/50 hover:text-white sm:w-auto"
            >
              Join as Publisher
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}