import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <main className="page">
      <h1>Profile</h1>
      <p className="lede">Update the name and email on this account. A new email has to be verified again.</p>
      <ProfileForm name={user.name} email={user.email} />
    </main>
  );
}
