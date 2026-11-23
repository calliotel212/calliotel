import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { LiveDemoPanel } from "@/components/live-demo-panel";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Voice demo — Calliotel AI agents",
  description: "Try Calliotel voice AI receptionists in Arabic and English from your browser.",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main className="section-padding">
        <div className="container-marketing">
          <p className="text-center text-sm text-slate-400">
            <Link href="/" className="text-adsfind-primary hover:underline">
              ← Back to AdsFind
            </Link>
          </p>
          <div className="mx-auto mt-8 max-w-2xl text-center">
            <h1 className="text-2xl font-bold text-white sm:text-3xl">Calliotel voice demo</h1>
            <p className="mt-3 text-slate-300">
              Talk to a sample AI receptionist in Arabic or English — right from your browser.
            </p>
          </div>
          <LiveDemoPanel />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}