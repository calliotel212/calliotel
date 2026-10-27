"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PopcornLoader } from "@/components/popcorn-loader";

export function GenerateVideoButton({ videoId }: { videoId: string }) {
  const router = useRouter();
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false);

  async function generate() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await fetch(`/api/generate/${encodeURIComponent(videoId)}`, { method: "POST" });
    } finally {
      pendingRef.current = false;
      setPending(false);
      router.refresh();
    }
  }

  return (
    <button
      className={pending ? "button button-primary is-loading" : "button button-primary"}
      type="button"
      disabled={pending}
      aria-busy={pending}
      onClick={generate}
    >
      {pending ? <PopcornLoader size="sm" label="Generating video" /> : null}
      Generate video
    </button>
  );
}
