import type { Metadata } from "next";
import Link from "next/link";
import { AdminAllowed, AdminDenied } from "@/components/admin-screen";
import { guardAdmin } from "@/lib/admin";
import { adminCounts } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const QUEUE_LABELS = [
  ["draft", "Draft"],
  ["approved", "Approved"],
  ["posted", "Posted"],
  ["failed", "Failed"],
] as const;

export default async function AdminPage() {
  const admin = await guardAdmin();
  if (!admin) return <AdminDenied />;
  const counts = await adminCounts();
  const queueTotal = QUEUE_LABELS.reduce((sum, [status]) => sum + counts.queue[status], 0);

  return (
    <AdminAllowed title="Dashboard" lede="Counts for this server. The lists are read-only except where a row can be marked read.">
      <dl className="admin-counts">
        <div>
          <dt>Users</dt>
          <dd>{counts.users}</dd>
        </div>
        <div>
          <dt>Verified users</dt>
          <dd>{counts.verifiedUsers}</dd>
        </div>
        <div>
          <dt>Suggestions</dt>
          <dd>{counts.suggestions}</dd>
        </div>
        <div>
          <dt>Contact messages</dt>
          <dd>{counts.messages}</dd>
        </div>
      </dl>
      <section className="panel" aria-labelledby="admin-queue-counts">
        <h2 id="admin-queue-counts">Queue by status</h2>
        <ul className="admin-list">
          {QUEUE_LABELS.map(([status, label]) => (
            <li key={status}>
              <p>
                {label}: {counts.queue[status]}
              </p>
            </li>
          ))}
        </ul>
        <p className="hint">Total queue rows: {queueTotal}</p>
        <p>
          <Link href="/admin/queue">Open the queue</Link>
        </p>
      </section>
      <p>
        <Link href="/admin/requests">Studio requests</Link> ({counts.requests})
      </p>
    </AdminAllowed>
  );
}
