import { PopcornLoader } from "@/components/popcorn-loader";

export default function Loading() {
  return (
    <main className="loader-page">
      <PopcornLoader size="lg" label="Loading" />
    </main>
  );
}
