import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Help" };

const QUESTIONS = [
  {
    q: "How long is an episode?",
    a: "Each episode is 1:00–1:30.",
  },
  {
    q: "How long is a story?",
    a: "A story is 60–75 episodes, about 1:00–1:30 altogether.",
  },
  {
    q: "How does playback work?",
    a: "You watch vertically. When you finish an episode it unlocks, and you scroll up into the next one.",
  },
  {
    q: "Is there a series to watch?",
    a: "Not yet. The first story has not been chosen. The scroll preview is a stack of placeholder cards, not a finished show.",
  },
  {
    q: "How do I sign in?",
    a: "Email and password work on this server. Google, Facebook, and Apple appear as Auth.js buttons and stay on “Not configured” until keys are set. Instagram is a follow link, not a login.",
  },
  {
    q: "I forgot my password.",
    a: "Use Forgot password. This demo does not send email. In local development the reset link is shown on the page and printed in the server log.",
  },
  {
    q: "Do I need to pay?",
    a: "No. dramame has no payments, coins, or paywall.",
  },
];

export default function HelpPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">Help</p>
      <h1>Questions</h1>
      <div className="faq">
        {QUESTIONS.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p>{item.a}</p>
          </details>
        ))}
      </div>
      <p>
        Still stuck? <Link href="/contact">Contact dramame</Link>.
      </p>
    </main>
  );
}
