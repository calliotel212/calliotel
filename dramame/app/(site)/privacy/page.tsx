import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy policy" };

export default function PrivacyPage() {
  return (
    <main className="narrow page prose">
      <p className="eyebrow">Privacy</p>
      <h1>Privacy policy</h1>
      <p>This page describes the dramame website you are using now. It is written for this product, not copied from another company’s policy.</p>
      <h2>What we store</h2>
      <p>
        If you create an account, we store your name, email, a hash of your password, whether the email is verified, notification choices, and which placeholder cards you have opened. Contact messages are stored with the name, email, and text you submit. Social sign-in, when configured, stores the provider name and that provider’s account id.
      </p>
      <h2>What we do not do</h2>
      <p>We do not sell your information. There is no ad network on this site, no payment account, and no coin balance. We do not ask for a phone number.</p>
      <h2>Cookies</h2>
      <p>
        Logging in sets a session cookie so you stay signed in. Remember me keeps that session longer. The cookie banner stores your accept or reject choice on this device. See the cookie policy for the short version.
      </p>
      <h2>How long it stays</h2>
      <p>Account data stays until you delete the account. Deleting the account removes the profile, password, connected providers, preferences, and preview progress from this server. Contact messages are kept so we can read them.</p>
      <h2>Contact</h2>
      <p>Questions about this policy can go to hello@dramame.net.</p>
    </main>
  );
}
