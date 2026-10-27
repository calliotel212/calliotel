"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GenerateVideoButton } from "@/components/generate-video-button";
import { PopcornLoader } from "@/components/popcorn-loader";

const POLL_MS = 5000;
const STEP_DELAY_MS = 500;
const ACTIVE_STATUSES = new Set(["queued", "generating", "assembling"]);

type VideoStatusName = "queued" | "generating" | "assembling" | "ready" | "failed";

export type VideoShotView = {
  index: number;
  prompt: string;
  durationSeconds: number;
  status: string | null;
  clipUrl: string | null;
  error: string | null;
};

type StatusPayload = {
  status: VideoStatusName;
  outputUrl: string | null;
  error: string | null;
};

type StepPayload = StatusPayload & {
  remaining: number;
  shots: VideoShotView[] | null;
};

function isStatusName(value: unknown): value is VideoStatusName {
  return value === "queued" || value === "generating" || value === "assembling" || value === "ready" || value === "failed";
}

function readPayload(value: unknown): StatusPayload | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (!isStatusName(record.status)) return null;
  return {
    status: record.status,
    outputUrl: typeof record.outputUrl === "string" ? record.outputUrl : null,
    error: typeof record.error === "string" ? record.error : null,
  };
}

function readShots(value: unknown): VideoShotView[] | null {
  if (!Array.isArray(value)) return null;
  const shots: VideoShotView[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const record = item as Record<string, unknown>;
    if (typeof record.index !== "number" || !Number.isInteger(record.index) || typeof record.prompt !== "string") return null;
    shots.push({
      index: record.index,
      prompt: record.prompt,
      durationSeconds: typeof record.durationSeconds === "number" ? record.durationSeconds : 10,
      status: typeof record.status === "string" ? record.status : null,
      clipUrl: typeof record.clipUrl === "string" ? record.clipUrl : null,
      error: typeof record.error === "string" ? record.error : null,
    });
  }
  return shots;
}

function readStep(value: unknown): StepPayload | null {
  const payload = readPayload(value);
  if (!payload || !value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const remaining = typeof record.remaining === "number" && Number.isFinite(record.remaining) ? record.remaining : 0;
  return { ...payload, remaining, shots: readShots(record.shots) };
}

function shotNeedsRetry(shot: VideoShotView): boolean {
  return shot.status === "failed" || shot.status === "generating" || shot.status === "assembling";
}

export function VideoStatusSection({
  videoId,
  initialStatus,
  initialOutputUrl,
  initialError,
  initialShots,
  children,
}: {
  videoId: string;
  initialStatus: VideoStatusName;
  initialOutputUrl: string | null;
  initialError: string | null;
  initialShots: VideoShotView[];
  children?: ReactNode;
}) {
  const router = useRouter();
  const liveRef = useRef(false);
  const cancelRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const runRef = useRef<(retry: boolean) => Promise<void>>(async () => {});
  const [status, setStatus] = useState(initialStatus);
  const [outputUrl, setOutputUrl] = useState(initialOutputUrl);
  const [error, setError] = useState(initialError);
  const [shots, setShots] = useState(initialShots);
  const [live, setLive] = useState(false);
  const [mode, setMode] = useState<"generate" | "retry" | null>(null);

  function stopLoop() {
    liveRef.current = false;
    setLive(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  runRef.current = async (retry: boolean) => {
    if (cancelRef.current) return;
    try {
      const response = await fetch(`/api/generate/step/${encodeURIComponent(videoId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ retry }),
      });
      const payload = readStep(await response.json().catch(() => null));
      if (cancelRef.current) return;
      if (!payload) {
        stopLoop();
        router.refresh();
        return;
      }
      setStatus(payload.status === "failed" || !response.ok ? "failed" : payload.status);
      setOutputUrl(payload.outputUrl);
      setError(payload.error ?? (payload.status === "failed" || !response.ok ? "Generation failed." : null));
      if (payload.shots) setShots(payload.shots);
      const failed = !response.ok || payload.status === "failed";
      const finished = payload.status === "ready" || payload.remaining <= 0;
      if (failed || finished) {
        stopLoop();
        router.refresh();
        return;
      }
      timerRef.current = window.setTimeout(() => {
        void runRef.current(false);
      }, STEP_DELAY_MS);
    } catch {
      if (cancelRef.current) return;
      stopLoop();
      router.refresh();
    }
  };

  function start(retry: boolean) {
    if (liveRef.current) return;
    liveRef.current = true;
    cancelRef.current = false;
    setLive(true);
    setMode(retry ? "retry" : "generate");
    setError(null);
    setStatus("generating");
    if (retry) {
      setShots((current) =>
        current.map((shot) => (shotNeedsRetry(shot) ? { ...shot, status: "queued", error: null, clipUrl: null } : shot)),
      );
    }
    void runRef.current(retry);
  }

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
      liveRef.current = false;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [videoId]);

  useEffect(() => {
    if (!ACTIVE_STATUSES.has(status)) return;

    let ignore = false;
    const intervalId = setInterval(() => {
      void (async () => {
        try {
          const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/status`, { cache: "no-store" });
          if (!response.ok || ignore) return;
          const payload = readPayload(await response.json());
          if (!payload || ignore) return;
          if (liveRef.current && payload.status === "queued") return;
          setStatus(payload.status);
          setOutputUrl(payload.outputUrl);
          setError(payload.error);
        } catch {
          // A dropped response should not stop polling. The next tick tries again.
        }
      })();
    }, POLL_MS);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, [status, videoId]);

  const brokenShot = shots.some(shotNeedsRetry);
  const showGenerate = !live && status === "queued" && !brokenShot;
  const showRetry = !live && !showGenerate && status !== "ready" && (status === "failed" || status === "generating" || status === "assembling" || brokenShot);

  return (
    <>
      <p className="lede" aria-live="polite">
        Status: {status}
      </p>
      {children}
      <div className="video-actions">
        {showGenerate ? <GenerateVideoButton pending={false} onClick={() => start(false)} /> : null}
        {showRetry ? (
          <button className="button button-primary" type="button" onClick={() => start(true)}>
            Retry failed shots
          </button>
        ) : null}
        {live ? (
          <button className="button button-primary is-loading" type="button" disabled aria-busy="true">
            <PopcornLoader size="sm" label="Generating video" />
            {mode === "retry" ? "Retry failed shots" : "Generate video"}
          </button>
        ) : null}
      </div>
      {status === "failed" && error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {status === "ready" ? (
        <div className="video-ready">
          <video className="video-player" controls preload="none" src={outputUrl ?? ""} />
          {outputUrl ? (
            <a className="button button-primary" href={outputUrl} download>
              Download
            </a>
          ) : null}
        </div>
      ) : null}
      <h2>Shot list</h2>
      {shots.length === 0 ? (
        <p>No shots yet.</p>
      ) : (
        <ol className="shot-list">
          {shots.map((shot) => (
            <li key={shot.index}>
              <p>{shot.prompt}</p>
              <p className="hint">
                {shot.durationSeconds} seconds{shot.status ? ` · ${shot.status}` : ""}
              </p>
              {shot.error ? <p className="form-error">{shot.error}</p> : null}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
