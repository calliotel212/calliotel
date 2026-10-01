import Link from "next/link";

export function MissingPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">404</p>
      <h1>That page is not here</h1>
      <p>The address does not match anything on Drama Me.</p>
      <div className="hero-actions">
        <Link className="button button-primary" href="/">
          Back home
        </Link>
        <Link className="button button-ghost" href="/help">
          Help
        </Link>
      </div>
    </main>
  );
}
