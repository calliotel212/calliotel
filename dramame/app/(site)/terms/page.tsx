import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of service" };

export default function TermsPage() {
  return (
    <main className="narrow page prose">
      <p className="eyebrow">Terms</p>
      <h1>Terms of service</h1>
      <p>These terms cover use of the dramame website. They are a plain-language agreement for this product.</p>
      <h2>The service</h2>
      <p>
        dramame is a vertical short-story site. Episodes are meant to run 1:00–1:30, and a story is meant to run 60–75 episodes. No series is published yet. Placeholder cards in the scroll preview are not a show and not a promise of a particular story.
      </p>
      <h2>Your account</h2>
      <p>
        You need an email and a password you choose, or a configured social provider. You are responsible for the password and for the name you display. Do not use someone else’s email. You can delete the account yourself.
      </p>
      <h2>Acceptable use</h2>
      <p>Do not break the site, probe other people’s accounts, or upload anything through the contact form that you do not have the right to send. The contact form is for notes to dramame.</p>
      <h2>No payments</h2>
      <p>There is nothing to buy here. No coins, passes, or paywall.</p>
      <h2>Changes</h2>
      <p>The site can change as the first series is chosen. These terms can be updated on this page. If you keep using dramame after that, the new terms apply.</p>
      <h2>Contact</h2>
      <p>hello@dramame.net</p>
    </main>
  );
}
