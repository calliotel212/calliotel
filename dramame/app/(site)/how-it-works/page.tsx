import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
  {
    n: "01",
    title: "Make an account",
    body: "Email and password work on this server. Social sign-in appears when provider keys are set.",
  },
  {
    n: "02",
    title: "Watch one minute",
    body: "An episode is vertical and runs 1:00–1:30. You are meant to finish it, not skip around a long film.",
  },
  {
    n: "03",
    title: "Scroll up",
    body: "The next episode stays locked until you open the one before it. Then you scroll up into it.",
  },
  {
    n: "04",
    title: "Stay with one story",
    body: "A story is 60–75 episodes, about an hour to an hour and a half, with the same plot from start to end.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="page narrow">
      <p className="eyebrow">How it works</p>
      <h1>One episode, then the next.</h1>
      <p className="lede">
        Drama Me is an AI cinematic short-story series. The player is a phone. The first story has not been chosen, so the scroll preview uses placeholder cards.
      </p>
      <ol className="steps">
        {STEPS.map((step) => (
          <li key={step.n}>
            <span>{step.n}</span>
            <div>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="hero-actions">
        <Link className="button button-primary" href="/series/preview">
          Preview the scroll
        </Link>
        <Link className="button button-ghost" href="/signup">
          Get Started
        </Link>
      </div>
    </main>
  );
}
