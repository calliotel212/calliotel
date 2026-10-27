"use client";

import { PopcornLoader } from "@/components/popcorn-loader";

export function GenerateVideoButton({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      className={pending ? "button button-primary is-loading" : "button button-primary"}
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={onClick}
    >
      {pending ? <PopcornLoader size="sm" label="Generating video" /> : null}
      Generate video
    </button>
  );
}
