import type { Metadata } from "next";
import { markRequestRead } from "@/lib/actions/admin";
import { AdminAllowed, AdminDenied } from "@/components/admin-screen";
import { MarkRead } from "@/components/mark-read";
import { guardAdmin } from "@/lib/admin";
import { listStudioRequests } from "@/lib/admin-data";
import { formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin requests",
  robots: { index: false, follow: false },
};

export default async function AdminRequestsPage() {
  const admin = await guardAdmin();
  if (!admin) return <AdminDenied />;
  const requests = await listStudioRequests();

  return (
    <AdminAllowed title="Studio requests" lede="Ideas sent from the studio page. This list does not start a series.">
      {requests.length === 0 ? (
        <p>No studio requests.</p>
      ) : (
        <ul className="admin-list">
          {requests.map((request) => (
            <li key={request.id}>
              <p>
                <strong>{request.name}</strong> · {request.email}
              </p>
              <p className="hint">{request.createdAt > 0 ? `${formatWhen(request.createdAt)} UTC` : "—"}</p>
              <p>{request.idea}</p>
              <MarkRead action={markRequestRead} id={request.id} read={request.readAt !== null} />
            </li>
          ))}
        </ul>
      )}
    </AdminAllowed>
  );
}
