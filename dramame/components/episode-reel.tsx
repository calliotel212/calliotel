"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { savePreviewProgress } from "@/lib/actions/progress";
import { PREVIEW_EPISODES } from "@/lib/episodes";
import { isEpisodeUnlocked } from "@/lib/unlock";

const STORAGE_KEY = "dramame-preview-opened";
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStored(): number {
  const stored = Number(localStorage.getItem(STORAGE_KEY) || "0");
  return Number.isFinite(stored) ? stored : 0;
}

export function EpisodeReel({ initialHighest }: { initialHighest: number }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const stored = useSyncExternalStore(subscribe, readStored, () => 0);
  const highest = Math.max(initialHighest, stored);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  function openEpisode(episodeNumber: number) {
    if (!isEpisodeUnlocked(episodeNumber, highest)) return;
    const next = Math.max(highest, episodeNumber);
    localStorage.setItem(STORAGE_KEY, String(next));
    emit();
    void savePreviewProgress(next);
  }

  const ordered = [...PREVIEW_EPISODES].reverse();

  return (
    <div
      ref={scrollerRef}
      className="reel"
      tabIndex={0}
      aria-label="Placeholder episode reel. Episode 1 starts at the bottom. Scroll up for the next card."
    >
      {ordered.map((episode) => {
        const unlocked = isEpisodeUnlocked(episode.number, highest);
        const opened = episode.number <= highest;
        const nextUnlocked = episode.number < PREVIEW_EPISODES.length && isEpisodeUnlocked(episode.number + 1, Math.max(highest, episode.number));
        return (
          <article key={episode.number} id={`episode-${episode.number}`} className="slide">
            <div className="poster" style={{ backgroundImage: episode.wash }}>
              <div className="poster-copy">
                <span className="badge">Placeholder</span>
                <p className="ep-num">Episode {String(episode.number).padStart(2, "0")} of 08</p>
                <h2>{episode.title}</h2>
                <p className="ep-time">1:00–1:30</p>
                {unlocked ? null : <p className="lock">Locked. Open the previous episode first.</p>}
                {unlocked && opened ? (
                  <p>{episode.number === PREVIEW_EPISODES.length ? "End of this preview." : nextUnlocked ? "Opened. Scroll up for the next episode." : "Opened."}</p>
                ) : null}
                {unlocked && !opened ? (
                  <button type="button" className="button button-primary" onClick={() => openEpisode(episode.number)}>
                    Open episode
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
