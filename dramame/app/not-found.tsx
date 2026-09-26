import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="narrow page">
        <p className="eyebrow">404</p>
        <h1>That page is not here</h1>
        <p>The address does not match anything on dramame.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/">
            Back home
          </Link>
          <Link className="button button-ghost" href="/help">
            Help
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
