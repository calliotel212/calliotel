export function LiveDemo() {
  return (
    <section id="demo" className="section-padding bg-navy-900/50">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Try the voice demo</h2>
          <p className="mt-3 text-slate-400">
            Talk to a sample AI receptionist in Arabic or English — right from your browser.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-700/80 bg-navy-800/60 p-8 shadow-xl">
          <div className="flex flex-col items-center gap-6">
            <div
              className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-navy-950/80"
              aria-hidden
            >
              <svg
                className="h-10 w-10 text-slate-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 18.75a6.75 6.75 0 006.75-6.75v-1.5m-6.75 7.5a6.75 6.75 0 01-6.75-6.75v-1.5m6.75 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <p className="text-center text-sm text-slate-400">
              Voice demo — coming soon
            </p>
            <p className="text-center text-xs text-slate-500">
              Pass 2 will add LiveKit WebRTC. No audio or tokens in this release.
            </p>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-lg bg-slate-700 px-6 py-3 text-sm font-medium text-slate-500"
              aria-disabled="true"
            >
              Start voice call
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
