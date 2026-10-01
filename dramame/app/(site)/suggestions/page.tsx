import type { Metadata } from "next";
import { SuggestionForm } from "@/components/suggestion-form";

export const metadata: Metadata = { title: "Suggest a story" };

export default function SuggestionsPage() {
  return (
    <main className="narrow page">
      <p className="eyebrow">Suggest a story</p>
      <h1>Tell us the story you want to step into.</h1>
      <p className="lede">
        Send a story idea. An email is optional, so we can write back later if that ever makes sense.
      </p>
      <SuggestionForm />
    </main>
  );
}
