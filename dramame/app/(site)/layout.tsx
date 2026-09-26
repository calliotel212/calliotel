import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#content">
        Skip to content
      </a>
      <SiteHeader />
      <div id="content" className="shell-main">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
