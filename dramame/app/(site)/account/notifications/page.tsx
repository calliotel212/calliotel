import type { Metadata } from "next";
import { PreferencesForm } from "@/components/preferences-form";
import { requireUser } from "@/lib/session";
import { getPreferences } from "@/lib/users";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireUser();
  const prefs = getPreferences(user.id);
  return (
    <main className="page">
      <h1>Notifications</h1>
      <p className="lede">Choose which email you want from dramame. Mail is not sent yet; the choices are stored with your account.</p>
      <PreferencesForm {...prefs} />
    </main>
  );
}
