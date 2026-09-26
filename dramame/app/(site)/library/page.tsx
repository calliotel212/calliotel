import type { Metadata } from "next";
import Link from "next/link";
import { PREVIEW_EPISODES, PREVIEW_SERIES_ID } from "@/lib/episodes";
import { getCurrentUser } from "@/lib/session";
import { getProgress } from "@/lib/users";

export const metadata: Metadata = { title: "Library" };

export default async function LibraryPage() {
  const user = await getCurrentUser();
  const opened = user ? getProgress(user.id, PREVIEW_SERIES_ID) : 0;
  return (
    <main className="narrow page">
      <p className="eyebrow">Library</p>
      <h1>Continue watching</h1>
      {opened > 0 ? (
        <article className="library-card">
          <span className="badge">Not a finished series</span>
          <h2>Placeholder reel</h2>
          <p>
            Opened {opened} of {PREVIEW_EPISODES.length} preview cards. These are empty placeholders, not episodes of a show.
          </p>
          <Link className="button button-primary" href="/series/preview">
            Back to the preview
          </Link>
        </article>
      ) : (
        <div className="empty" role="status">
          <p>Nothing in progress. When a series is published, episodes you open will show up here.</p>
          <p>
            <Link href="/series/preview">Try the scroll preview</Link>
          </p>
        </div>
      )}
      {user ? null : (
        <p>
          <Link href="/login?callbackUrl=/library">Log in</Link> to keep preview progress on your account.
        </p>
      )}
    </main>
  );
}
