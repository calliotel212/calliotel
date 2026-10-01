import { MissingPage } from "@/components/missing-page";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <MissingPage />
      <SiteFooter />
    </>
  );
}
