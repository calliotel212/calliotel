import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <main className="narrow page prose">
      <p className="eyebrow">About</p>
      <h1>What dramame is</h1>
      <p>
        dramame.net is a place for vertical short-story series. An episode lasts a minute to a minute and a half. A story holds 60 to 75 of them, so the whole thing runs about an hour to an hour and a half.
      </p>
      <p>
        You finish an episode, the next one unlocks, and you scroll up into it. The plot is meant to stay one plot. People stay the same people. A shot has to be able to continue from the shot before it.
      </p>
      <p>
        The first series has not been chosen. Nothing on this site is a finished show, and the scroll preview is only there so you can feel the player. Create an account when you want a library waiting for the real thing.
      </p>
      <p>
        <Link href="/signup">Create an account</Link> or read the <Link href="/help">help page</Link>.
      </p>
    </main>
  );
}
