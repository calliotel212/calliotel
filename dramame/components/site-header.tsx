import Link from "next/link";
import { auth } from "@/auth";
import { SiteNav } from "@/components/site-nav";

export async function SiteHeader() {
  const session = await auth();
  return (
    <header className="site-header">
      <Link href="/" className="wordmark">
        dramame
      </Link>
      <SiteNav isAuthed={Boolean(session?.user)} />
    </header>
  );
}
