import { auth } from "@/auth";
import { BrandLockup } from "@/components/brand-lockup";
import { SiteNav } from "@/components/site-nav";

export async function SiteHeader() {
  const session = await auth();
  return (
    <header className="site-header">
      <BrandLockup />
      <SiteNav isAuthed={Boolean(session?.user)} />
    </header>
  );
}
