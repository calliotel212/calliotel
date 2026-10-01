import type { Metadata } from "next";
import { markSuggestionRead } from "@/lib/actions/admin";
import { AdminAllowed, AdminDenied } from "@/components/admin-screen";
import { MarkRead } from "@/components/mark-read";
import { guardAdmin } from "@/lib/admin";
import { formatWhen } from "@/lib/time";
import { listSuggestions } from "@/lib/users";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin suggestions",
  robots: { index: false, follow: false },
};

export default async function AdminSuggestionsPage() {
  const admin = await guardAdmin();
  if (!admin) return <AdminDenied />;
  const suggestions = await listSuggestions();

  return (
    <AdminAllowed title="Suggestions" lede="Story ideas sent from the site.">
      {suggestions.length === 0 ? (
        <p>No story suggestions.</p>
      ) : (
        <ul className="admin-list">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <p>{suggestion.idea}</p>
              <p>{suggestion.email ?? "No email"}</p>
              <p className="hint">{suggestion.createdAt > 0 ? `${formatWhen(suggestion.createdAt)} UTC` : "—"}</p>
              <MarkRead action={markSuggestionRead} id={suggestion.id} read={suggestion.readAt !== null} />
            </li>
          ))}
        </ul>
      )}
    </AdminAllowed>
  );
}
