import Link from "next/link";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  return (
    <main>
      {deleted === "1" ? (
        <p className="banner" role="status">
          Your account was deleted.
        </p>
      ) : null}
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="gold-dot" aria-hidden="true" />
            Vertical stories
          </p>
          <h1>
            One minute.
            <br />
            Then the next.
          </h1>
          <p className="lede">
            dramame is a home for vertical short-story series. Each episode runs 1:00–1:30. A full story is 60–75 episodes, about an hour to an hour and a half. Finish one, it unlocks, and you scroll up into the next.
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
        <figure className="phone">
          <div className="phone-screen" aria-hidden="true">
            <span className="badge">Preview</span>
            <p className="phone-kicker">Player frame</p>
            <p className="phone-title">Placeholder card</p>
            <div className="phone-bar" />
          </div>
          <figcaption>Player preview. Not a finished series, and nothing is streaming yet.</figcaption>
        </figure>
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
