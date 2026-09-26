import type { Metadata } from "next";
import Link from "next/link";
import { DevNotice } from "@/components/dev-notice";
import { ResendForm } from "@/components/resend-form";
import { PREVIEW_SERIES_ID } from "@/lib/episodes";
import { requireUser } from "@/lib/session";
import { SOCIAL_LINKS } from "@/lib/social";
import { getProgress, latestDevLink } from "@/lib/users";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  const opened = getProgress(user.id, PREVIEW_SERIES_ID);
  const verifyUrl = user.emailVerified ? null : latestDevLink(user.id, "verify");
  return (
    <main className="page">
      <p className="eyebrow">Account</p>
      <h1>Hello, {user.name}</h1>
      <p className="lede">{user.email}</p>
      {user.emailVerified ? (
        <p className="form-note">Email verified.</p>
      ) : (
        <section className="panel">
          <h2>Verify your email</h2>
          <p>Your address is saved, and it is not verified yet.</p>
          <ResendForm />
          <DevNotice url={verifyUrl} detail="Verification link from this server. It is also printed in the server log." />
        </section>
      )}
      <section className="panel">
        <h2>Continue</h2>
        {opened > 0 ? (
          <p>You have opened {opened} placeholder card{opened === 1 ? "" : "s"} in the scroll preview.</p>
        ) : (
          <p>Nothing is in progress. The scroll preview is a set of placeholder cards, not a series.</p>
        )}
        <div className="hero-actions">
          <Link className="button button-primary" href="/library">
            Library
          </Link>
          <Link className="button button-ghost" href="/series/preview">
            Scroll preview
          </Link>
        </div>
      </section>
      <section className="panel">
        <h2>Follow</h2>
        <p className="hint">Placeholder profiles, not live accounts yet. Instagram is a follow link, not a login.</p>
        <ul className="follow-list">
          {SOCIAL_LINKS.map((link) => (
            <li key={link.name}>
              <a href={link.href} rel="noreferrer">
                {link.name}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
