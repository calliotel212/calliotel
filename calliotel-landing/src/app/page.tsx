import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { AuditStrategyWidget } from "@/components/audit-strategy-widget";
import { LiveDemo } from "@/components/live-demo";
import { HowItWorks } from "@/components/how-it-works";
import { Pricing } from "@/components/pricing";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <AuditStrategyWidget />
        <LiveDemo />
        <HowItWorks />
        <Pricing />
      </main>
      <SiteFooter />
    </>
  );
}