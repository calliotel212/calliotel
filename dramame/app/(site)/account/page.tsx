import type { Metadata } from "next";
import Link from "next/link";
import { DevNotice } from "@/components/dev-notice";
import { ResendForm } from "@/components/resend-form";
import { logout } from "@/lib/actions/auth";
import { requireUser } from "@/lib/session";
import { latestDevLink, listOAuth } from "@/lib/users";

export const metadata: Metadata = { title: "Account" };

const SIGN_IN_PROVIDERS = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
  { id: "apple", label: "Apple" },
] as const;

export default async function AccountPage() {
  const user = await requireUser();
  const verifyUrl = user.emailVerified ? null : await latestDevLink(user.id, "verify");
  const linked = new Set((await listOAuth(user.id)).map((row) => row.provider));
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
        <h2>Connected accounts</h2>
        <ul className="provider-list">
          {SIGN_IN_PROVIDERS.map((provider) => (
            <li key={provider.id}>
              <p className="provider-name">{provider.label}</p>
              <p className="hint">{linked.has(provider.id) ? "Connected" : "Not connected"}</p>
            </li>
          ))}
        </ul>
        <p>
          <Link href="/account/connected">Manage connected accounts</Link>
        </p>
      </section>
      <section className="panel">
        <h2>Next</h2>
        <p>Watch the scroll preview, or send a story idea.</p>
        <div className="hero-actions">
          <Link className="button button-primary" href="/series/preview">
            Preview
          </Link>
          <Link className="button button-ghost" href="/suggestions">
            Suggest a story
          </Link>
        </div>
      </section>
      <form action={logout}>
        <button className="button button-ghost" type="submit">
          Sign out
        </button>
      </form>
    </main>
  );
}
