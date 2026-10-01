import type { Metadata } from "next";
import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Profile" };

function avatarInitial(name: string): string {
  const first = Array.from(name.trim())[0];
  return first ? first.toUpperCase() : "?";
}

export default async function ProfilePage() {
  const user = await requireUser();
  return (
    <main className="page">
      <h1>Profile</h1>
      <p className="lede">Display name and email. Changing the email sends a new verification.</p>
      <p className="avatar" aria-hidden="true">{avatarInitial(user.name)}</p>
      <ProfileForm name={user.name} email={user.email} />
    </main>
  );
}
