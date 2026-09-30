import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { LiveDemo } from "@/components/live-demo";
import { HowItWorks } from "@/components/how-it-works";
import { Pricing } from "@/components/pricing";
import { Testimonials } from "@/components/testimonials";
import { Faq } from "@/components/faq";
import { CtaBand } from "@/components/cta-band";
import { SiteFooter } from "@/components/site-footer";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <LiveDemo />
        <HowItWorks />
        <Pricing />
        <Testimonials />
        <Faq />
        <CtaBand />
      </main>
      <SiteFooter />
    </>
  );
}
