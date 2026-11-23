import type { ReactNode } from "react";
import { APP_ADVERTISE_URL } from "@/lib/app-url";

export function LiveDemo() {
  const advertiseUrl = APP_ADVERTISE_URL();

  return (
    <section id="demo" className="section-padding border-y border-slate-800 bg-slate-800/20">
      <div className="container-marketing">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Live in the conversation</h2>
          <p className="mt-3 text-slate-300">
            When users ask AI for recommendations, AdsFind surfaces a relevant sponsored offer —
            native, contextual, and measurable.
          </p>
        </div>

        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-2xl border border-slate-800 bg-[#0A0F1C] shadow-2xl shadow-black/40">
          <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-800/60 px-4 py-3">
            <WindowDot className="h-3 w-3 rounded-full bg-red-500/80" />
            <WindowDot className="h-3 w-3 rounded-full bg-amber-400/80" />
            <WindowDot className="h-3 w-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-xs text-slate-400">AI Assistant</span>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            <ChatBubble role="user">
              I need a car rental in Beirut for next week — something reliable near the airport.
            </ChatBubble>
            <ChatBubble role="assistant">
              You&apos;ll want a company with airport pickup and full insurance. I found a few
              options with good reviews for short-term rentals in Beirut.
            </ChatBubble>

            <div className="rounded-xl border border-slate-700 bg-slate-800/80 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  Sponsored
                </span>
              </div>
              <p className="mt-2 font-semibold text-white">Beirut Drive — Airport VIP Rentals</p>
              <p className="mt-1 text-sm text-slate-300">
                From $42/day · Free airport delivery · Book in 60 seconds
              </p>
              <a
                href={advertiseUrl}
                className="mt-4 inline-flex rounded-lg bg-adsfind-primary px-4 py-2 text-sm font-semibold text-[#0A0F1C] transition hover:brightness-110"
              >
                View Offer
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WindowDot({ className }: { className: string }) {
  return <span className={`inline-block ${className}`} aria-hidden />;
}

function ChatBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-slate-800 px-4 py-3 text-sm text-slate-100">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-slate-800 bg-slate-800/40 px-4 py-3 text-sm text-slate-300">
        {children}
      </div>
    </div>
  );
}