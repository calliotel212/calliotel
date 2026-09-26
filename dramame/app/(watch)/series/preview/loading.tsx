import { PopcornLoader } from "@/components/popcorn-loader";

export default function LoadingPreview() {
  return (
    <main className="loader-page loader-page-fill">
      <PopcornLoader size="lg" label="Loading the preview" />
    </main>
  );
}
