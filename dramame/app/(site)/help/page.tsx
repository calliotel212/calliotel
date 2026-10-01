import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Help" };

export default function HelpPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">Help</p>
      <h1>Get help</h1>
      <p className="lede">
        Help and FAQ share one list of questions. That list is on the FAQ page. This page is for reaching a person when the list does not answer it.
      </p>
      <div className="hero-actions">
        <Link className="button button-primary" href="/faq">
          Read the FAQ
        </Link>
        <Link className="button button-ghost" href="/contact">
          Contact Drama Me
        </Link>
      </div>
      <p>
        Email <a href="mailto:hello@dramame.net">hello@dramame.net</a>. The contact form saves your note on this server. It does not send mail.
      </p>
    </main>
  );
}
