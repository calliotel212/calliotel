import type { Metadata } from "next";
import { AdminAllowed, AdminDenied } from "@/components/admin-screen";
import { guardAdmin } from "@/lib/admin";
import { listAdminQueue } from "@/lib/admin-data";
import { formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin queue",
  robots: { index: false, follow: false },
};

export default async function AdminQueuePage() {
  const admin = await guardAdmin();
  if (!admin) return <AdminDenied />;
  const rows = await listAdminQueue();

  return (
    <AdminAllowed title="Queue" lede="Read-only post queue. Nothing is sent from this page.">
      {rows.length === 0 ? (
        <p>No queue rows.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Provider</th>
                <th>Status</th>
                <th>Scheduled</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.email}</td>
                  <td>{row.provider}</td>
                  <td>{row.status}</td>
                  <td>{row.scheduledAt > 0 ? `${formatWhen(row.scheduledAt)} UTC` : "—"}</td>
                  <td>{row.error ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminAllowed>
  );
}
