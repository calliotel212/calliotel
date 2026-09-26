import Link from "next/link";
import { NightEntrance } from "@/components/night-entrance";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  return (
    <main className="home">
      {deleted === "1" ? (
        <p className="banner" role="status">
          Your account was deleted.
        </p>
      ) : null}
      <section className="hero night">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="gold-dot" aria-hidden="true" />
            Movie night
          </p>
          <h1>
            Let the
            <br />
            room go.
          </h1>
          <p className="lede">
            The theater is the phone. Its screen is already glowing, and the rest of the room can wait. dramame is a vertical short-story series: each episode runs 1:00–1:30, a story is 60–75 episodes, and when one ends you scroll up into the next.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/signup">
              Create an account
            </Link>
            <Link className="button button-ghost" href="/series/preview">
              Preview the scroll
            </Link>
          </div>
        </div>
        <NightEntrance />
      </section>
      <dl className="facts">
        <div>
          <dt>Each episode</dt>
          <dd>1:00–1:30</dd>
        </div>
        <div>
          <dt>A full story</dt>
          <dd>60–75 episodes</dd>
        </div>
        <div>
          <dt>How you continue</dt>
          <dd>Scroll up</dd>
        </div>
      </dl>
      <section className="band">
        <h2>No series is streaming yet.</h2>
        <p>
          Plot and pictures are meant to stay consistent from one episode to the next. The first story has not been chosen, so this site does not present a show as live. The scroll preview uses empty placeholder cards.
        </p>
        <Link className="button button-primary" href="/signup">
          Create an account
        </Link>
      </section>
    </main>
  );
}
