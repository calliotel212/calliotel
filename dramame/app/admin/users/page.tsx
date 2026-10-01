import type { Metadata } from "next";
import { AdminAllowed, AdminDenied } from "@/components/admin-screen";
import { guardAdmin } from "@/lib/admin";
import { listAdminUsers } from "@/lib/admin-data";
import { formatWhen } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin users",
  robots: { index: false, follow: false },
};

function when(ms: number) {
  return ms > 0 ? `${formatWhen(ms)} UTC` : "—";
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await guardAdmin();
  if (!admin) return <AdminDenied />;
  const { q = "" } = await searchParams;
  const query = q.trim();
  const users = await listAdminUsers(query);

  return (
    <AdminAllowed title="Users" lede="Read-only. Search matches the email.">
      <form className="form search-form" action="/admin/users" method="get" role="search">
        <div className="field">
          <label htmlFor="q">Search by email</label>
          <input id="q" name="q" type="search" defaultValue={query} placeholder="Email" />
        </div>
        <button className="button button-primary" type="submit">
          Search
        </button>
      </form>
      {users.length === 0 ? (
        <p>{query ? "No users match that email." : "No users."}</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Verified</th>
                <th>Created</th>
                <th>Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.verified ? "Verified" : "Not verified"}</td>
                  <td>{when(user.createdAt)}</td>
                  <td>{user.lastLogin ? when(user.lastLogin) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminAllowed>
  );
}
