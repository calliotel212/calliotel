import type { Metadata } from "next";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCurrentUser } from "@/lib/session";
import { listMessages, listSuggestions } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

function allowedAdminEmail(): string | null {
  const value = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return value || null;
}

function formatWhen(ms: number) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(ms));
}

function ClosedPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">Admin</p>
      <h1>Not configured</h1>
      <p className="lede">This page is closed.</p>
    </main>
  );
}

export default async function AdminPage() {
  await connection();
  const allowed = allowedAdminEmail();
  return (
    <>
      <SiteHeader />
      {allowed ? <AdminInbox allowed={allowed} /> : <ClosedPage />}
      <SiteFooter />
    </>
  );
}

async function AdminInbox({ allowed }: { allowed: string }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.email.trim().toLowerCase() !== allowed) return <ClosedPage />;

  const messages = await listMessages();
  const suggestions = await listSuggestions();

  return (
    <main className="narrow page">
      <p className="eyebrow">Admin</p>
      <h1>Inbox</h1>
      <p className="lede">Contact messages and story suggestions. This page is read-only.</p>

      <section className="panel" aria-labelledby="admin-messages">
        <h2 id="admin-messages">Contact messages</h2>
        {messages.length === 0 ? (
          <p>No contact messages.</p>
        ) : (
          <ul className="admin-list">
            {messages.map((message) => (
              <li key={message.id}>
                <p>
                  <strong>{message.name}</strong> · {message.email}
                </p>
                <p className="hint">{formatWhen(message.createdAt)} UTC</p>
                <p>{message.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel" aria-labelledby="admin-suggestions">
        <h2 id="admin-suggestions">Story suggestions</h2>
        {suggestions.length === 0 ? (
          <p>No story suggestions.</p>
        ) : (
          <ul className="admin-list">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <p>{suggestion.email ?? "No email"}</p>
                <p className="hint">{formatWhen(suggestion.createdAt)} UTC</p>
                <p>{suggestion.idea}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
