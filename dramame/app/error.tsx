"use client";

import Link from "next/link";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="narrow page">
      <Link className="wordmark" href="/">
        dramame
      </Link>
      <h1>Something went wrong</h1>
      <p>This page did not finish loading.</p>
      <button type="button" className="button button-primary" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
