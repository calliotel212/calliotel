import type { Metadata } from "next";
import Link from "next/link";
import { EpisodeReel } from "@/components/episode-reel";
import { PREVIEW_SERIES_ID } from "@/lib/episodes";
import { getCurrentUser } from "@/lib/session";
import { getProgress } from "@/lib/users";

export const metadata: Metadata = {
  title: "Scroll preview",
  description: "A vertical placeholder reel. Not a finished series.",
};

export default async function PreviewPage() {
  const user = await getCurrentUser();
  const initialHighest = user ? getProgress(user.id, PREVIEW_SERIES_ID) : 0;
  return (
    <div className="watch">
      <a className="skip" href="#reel">
        Skip to the reel
      </a>
      <header className="watch-bar">
        <Link href="/" className="wordmark">
          Drama Me
        </Link>
        <p>Preview only. Placeholder cards, not a finished series.</p>
        <Link href="/">Close</Link>
      </header>
      <div id="reel">
        <EpisodeReel initialHighest={initialHighest} />
      </div>
    </div>
  );
}
