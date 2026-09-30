const quotes = [
  {
    text: "We stopped losing leads after hours. Our clinic books appointments in Arabic without extra staff.",
    author: "Layla M.",
    role: "Operations, Dubai healthcare clinic",
  },
  {
    text: "Bilingual reception that actually sounds natural. Our customers don't realize it's AI until we tell them.",
    author: "Omar K.",
    role: "Founder, Riyadh property services",
  },
  {
    text: "Setup took an afternoon. Now every inbound call gets a professional greeting in English or Arabic.",
    author: "Sarah T.",
    role: "GM, Bahrain logistics company",
  },
];

export function Testimonials() {
  return (
    <section className="section-padding">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Trusted by MENA teams</h2>
          <p className="mt-3 text-slate-400">Placeholder stories — replace with real customers later.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <blockquote
              key={q.author}
              className="rounded-2xl border border-slate-700/80 bg-navy-900/40 p-6"
            >
              <p className="text-sm leading-relaxed text-slate-300">&ldquo;{q.text}&rdquo;</p>
              <footer className="mt-4 border-t border-slate-800 pt-4">
                <cite className="not-italic">
                  <span className="block text-sm font-medium text-white">{q.author}</span>
                  <span className="text-xs text-slate-500">{q.role}</span>
                </cite>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
