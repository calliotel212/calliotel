import type { Metadata } from "next";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  return (
    <main className="narrow page">
      <p className="eyebrow">Search</p>
      <h1>Find a series</h1>
      <form className="form search-form" action="/search" method="get" role="search">
        <div className="field">
          <label htmlFor="q">Search</label>
          <input id="q" name="q" type="search" defaultValue={query} placeholder="Series title" />
        </div>
        <button className="button button-primary" type="submit">
          Search
        </button>
      </form>
      <div className="empty" role="status">
        {query ? (
          <p>No results for “{query}”. Nothing is published yet.</p>
        ) : (
          <p>Search will look through series. None are published yet.</p>
        )}
      </div>
    </main>
  );
}
