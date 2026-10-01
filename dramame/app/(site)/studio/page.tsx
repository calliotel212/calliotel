import type { Metadata } from "next";
import { StudioForm } from "@/components/studio-form";

export const metadata: Metadata = { title: "Studio" };

const SECTIONS = [
  {
    title: "Pick a seed",
    body: "Pick a story seed from our list, or send your own.",
  },
  {
    title: "We generate the series",
    body: "We generate the whole series: 60–75 episodes, 1:00–1:30 each, coherent characters and wardrobe.",
  },
  {
    title: "Review and publish",
    body: "You review and publish. Auto-post to TikTok and Instagram when connected.",
  },
];

export default function StudioPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">Studio</p>
      <h1>Make your own one-minute series.</h1>
      <ol className="steps">
        {SECTIONS.map((section, index) => (
          <li key={section.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <h2>Send a one-line idea</h2>
      <StudioForm />
    </main>
  );
}
