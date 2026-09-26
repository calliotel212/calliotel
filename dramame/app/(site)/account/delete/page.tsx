import type { Metadata } from "next";
import { DeleteForm } from "@/components/delete-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Delete account" };

export default async function DeletePage() {
  const user = await requireUser();
  return (
    <main className="page">
      <h1>Delete account</h1>
      <p className="lede">This is permanent on this server. There is no recovery inbox.</p>
      <DeleteForm email={user.email} />
    </main>
  );
}
