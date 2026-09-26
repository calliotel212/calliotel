import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cookie policy" };

export default function CookiesPage() {
  return (
    <main className="narrow page prose">
      <p className="eyebrow">Cookies</p>
      <h1>Cookie policy</h1>
      <p>dramame uses a small number of cookies and one on-device choice. This page says what they are.</p>
      <h2>Essential session cookie</h2>
      <p>
        When you log in, Auth.js sets a session cookie so the server knows it is you. If you check Remember me, that session lasts about 30 days. If you do not, it lasts about 12 hours. This cookie is required to stay logged in. Rejecting the banner does not remove it, because the site cannot keep you signed in without it.
      </p>
      <h2>Cookie choice</h2>
      <p>
        The banner stores “accepted” or “rejected” in local storage on your device, not in a cookie. We have no advertising or analytics cookies. Reject means we will not add optional cookies later without asking again on this browser.
      </p>
      <h2>What we skip</h2>
      <p>No third-party ad cookies, no tracking pixels, and no social plugins that set cookies just for a follow link.</p>
    </main>
  );
}
