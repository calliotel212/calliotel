import { LiveDemoPanel } from "@/components/live-demo-panel";

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
        <LiveDemoPanel />
      </div>
    </section>
  );
}
