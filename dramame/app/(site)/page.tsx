import Link from "next/link";

const POINTS = [
  {
    title: "Short episodes",
    body: "Each one runs 1:00–1:30.",
    icon: "clock",
  },
  {
    title: "A full story",
    body: "60–75 episodes, about an hour to an hour and a half.",
    icon: "stack",
  },
  {
    title: "Scroll up",
    body: "Finish an episode, then scroll up into the next.",
    icon: "up",
  },
  {
    title: "Suggest a story",
    body: "Send an idea. Compensation is not decided.",
    icon: "note",
  },
] as const;

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
          <h1>
            Leave the room.
            <br />
            Step into the story.
          </h1>
          <p className="lede">
            Drama Me is an AI cinematic short-story series. Each episode runs 1:00–1:30, a story is 60–75 episodes, and when one ends you scroll up into the next.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/signup">
              Get Started
            </Link>
            <Link className="button button-ghost" href="/suggestions">
              Suggest a story
            </Link>
          </div>
        </div>
        <figure className="hero-stage">
          <img
            src="/hero-phone-theater.png"
            alt="A giant phone used as a tiny theater. People walk up steps into the glowing screen, with popcorn, a drink, a ticket, loose kernels, and a film strip curling around the phone."
            width={900}
            height={1200}
          />
          <figcaption>Interface preview. No series is streaming yet.</figcaption>
        </figure>
      </section>
      <section className="points" aria-label="How Drama Me works">
        {POINTS.map((point) => (
          <article key={point.title} className="point">
            <PointIcon name={point.icon} />
            <h2>{point.title}</h2>
            <p>{point.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

function PointIcon({ name }: { name: (typeof POINTS)[number]["icon"] }) {
  if (name === "clock") {
    return (
      <svg className="point-icon" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 9.5V16l4.2 2.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "stack") {
    return (
      <svg className="point-icon" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="8" y="6" width="12" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <rect x="11" y="9" width="12" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "up") {
    return (
      <svg className="point-icon" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M16 24V9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M10 14.5 16 8.5l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg className="point-icon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 7.5h10l4 4V25H9z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M18.5 7.8V12H23" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 16.5h8M12 20.5h6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
