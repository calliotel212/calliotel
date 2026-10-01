import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Genres" };

const GENRES = [
  { name: "Romance", detail: "Two people, one feeling, carried across a whole story." },
  { name: "Mystery", detail: "A question that stays the same question from episode to episode." },
  { name: "Fantasy", detail: "A world with rules, shown a minute at a time." },
  { name: "Thriller", detail: "Pressure that picks up when you scroll up." },
  { name: "Comedy", detail: "Short scenes with the same people, not a new joke every card." },
  { name: "Drama", detail: "A plot that can continue from the shot before it." },
];

export default function GenresPage() {
  return (
    <main className="page narrow">
      <p className="eyebrow">Genres</p>
      <h1>Shelves, not a live catalog.</h1>
      <p className="lede">
        These are the kinds of stories Drama Me is built for. No series is streaming yet, so this page does not list shows you can play.
      </p>
      <ul className="genre-list">
        {GENRES.map((genre) => (
          <li key={genre.name}>
            <h2>{genre.name}</h2>
            <p>{genre.detail}</p>
          </li>
        ))}
      </ul>
      <p>
        Have a kind of story that is missing? <Link href="/suggestions">Suggest a story</Link>.
      </p>
    </main>
  );
}
