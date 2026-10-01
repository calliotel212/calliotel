import type { Metadata } from "next";
import { markMessageRead } from "@/lib/actions/admin";
import { AdminAllowed, AdminDenied } from "@/components/admin-screen";
import { MarkRead } from "@/components/mark-read";
import { guardAdmin } from "@/lib/admin";
import { formatWhen } from "@/lib/time";
import { listMessages } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin messages",
  robots: { index: false, follow: false },
};

export default async function AdminMessagesPage() {
  const admin = await guardAdmin();
  if (!admin) return <AdminDenied />;
  const messages = await listMessages();

  return (
    <AdminAllowed title="Messages" lede="Contact form messages.">
      {messages.length === 0 ? (
        <p>No contact messages.</p>
      ) : (
        <ul className="admin-list">
          {messages.map((message) => (
            <li key={message.id}>
              <p>
                <strong>{message.name}</strong> · {message.email}
              </p>
              <p className="hint">{message.createdAt > 0 ? `${formatWhen(message.createdAt)} UTC` : "—"}</p>
              <p>{message.body}</p>
              <MarkRead action={markMessageRead} id={message.id} read={message.readAt !== null} />
            </li>
          ))}
        </ul>
      )}
    </AdminAllowed>
  );
}
