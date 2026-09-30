"use client";

import { useState } from "react";

const items = [
  {
    q: "What languages does Calliotel support?",
    a: "Arabic and English out of the box, with dialect-friendly phrasing tuned for MENA markets.",
  },
  {
    q: "Do I need my own phone number?",
    a: "You can forward your existing business line or provision numbers through the dashboard during setup.",
  },
  {
    q: "Can the AI book appointments?",
    a: "Yes. Pro and Enterprise plans include calendar-aware booking flows you configure in setup.",
  },
  {
    q: "Is there a contract?",
    a: "Starter and Pro are month-to-month. Enterprise agreements are tailored to your volume and SLA needs.",
  },
  {
    q: "How fast can we go live?",
    a: "Most teams complete signup and basic setup in under a day; complex integrations may take longer.",
  },
  {
    q: "Where is call data stored?",
    a: "Call metadata and summaries are stored securely; enterprise customers can discuss data residency requirements.",
  },
  {
    q: "When will the browser voice demo be available?",
    a: "The interactive LiveKit demo ships in Pass 2. This page is marketing-only until then.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="section-padding bg-navy-900/50">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">FAQ</h2>
          <p className="mt-3 text-slate-400">Common questions about AI phone agents.</p>
        </div>
        <div className="mx-auto mt-10 max-w-2xl divide-y divide-slate-800 rounded-2xl border border-slate-700/80 bg-navy-950/50">
          {items.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={item.q}>
                <h3>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-medium text-white hover:bg-navy-800/30"
                    aria-expanded={isOpen}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                  >
                    {item.q}
                    <span className="shrink-0 text-accent-400" aria-hidden>
                      {isOpen ? "−" : "+"}
                    </span>
                  </button>
                </h3>
                {isOpen ? (
                  <p className="px-5 pb-4 text-sm leading-relaxed text-slate-400">{item.a}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
