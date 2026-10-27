"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GenerateVideoButton } from "@/components/generate-video-button";
import { PopcornLoader } from "@/components/popcorn-loader";

const POLL_MS = 5000;
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

function readMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.message === "string" && record.message.trim()) return record.message;
  if (typeof record.error === "string" && record.error.trim()) return record.error;
  return null;
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
  const postingRef = useRef(false);
  const cancelRef = useRef(false);
  const [status, setStatus] = useState(initialStatus);
  const [outputUrl, setOutputUrl] = useState(initialOutputUrl);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const [shots, setShots] = useState(initialShots);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    cancelRef.current = false;
    return () => {
      cancelRef.current = true;
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
          if ((status === "generating" || status === "assembling") && payload.status === "queued") return;
          setStatus(payload.status);
          setOutputUrl(payload.outputUrl);
          setError(payload.error);
          if (payload.status === "ready" || payload.status === "failed") router.refresh();
        } catch {
          // A dropped response should not stop polling. The next tick tries again.
        }
      })();
    }, POLL_MS);

    return () => {
      ignore = true;
      clearInterval(intervalId);
    };
  }, [status, videoId, router]);

  async function start(retry: boolean) {
    if (postingRef.current) return;
    if (status === "generating" || status === "assembling") return;
    postingRef.current = true;
    setSubmitting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/generate/background/${encodeURIComponent(videoId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ retry }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (cancelRef.current) return;
      if (!response.ok) {
        const message = readMessage(payload) ?? "Generation failed.";
        setNotice(message);
        const bodyStatus = payload && typeof payload === "object" ? (payload as { status?: unknown }).status : null;
        if (message === "Video is already generating. Please wait.") setStatus("generating");
        else if (isStatusName(bodyStatus)) setStatus(bodyStatus);
        const bodyShots = payload && typeof payload === "object" ? readShots((payload as { shots?: unknown }).shots) : null;
        if (bodyShots) setShots(bodyShots);
        return;
      }
      setError(null);
      setStatus("generating");
      if (retry) {
        setShots((current) =>
          current.map((shot) => (shotNeedsRetry(shot) ? { ...shot, status: "queued", error: null, clipUrl: null } : shot)),
        );
      }
    } catch {
      if (!cancelRef.current) setNotice("Generation failed.");
    } finally {
      postingRef.current = false;
      setSubmitting(false);
    }
  }

  const busy = submitting || status === "generating" || status === "assembling";
  const brokenShot = shots.some(shotNeedsRetry);
  const showGenerate = !busy && status === "queued" && !brokenShot;
  const showRetry = !busy && status !== "ready" && (status === "failed" || brokenShot);

  return (
    <>
      <p className="lede" aria-live="polite">
        Status: {status}
      </p>
      {children}
      <div className="video-actions">
        {showGenerate ? <GenerateVideoButton pending={false} onClick={() => void start(false)} /> : null}
        {showRetry ? (
          <button className="button button-primary" type="button" onClick={() => void start(true)}>
            Retry failed shots
          </button>
        ) : null}
        {busy ? (
          <button className="button button-primary is-loading" type="button" disabled aria-busy="true">
            <PopcornLoader size="sm" label="Generating video" />
            Generating...
          </button>
        ) : null}
      </div>
      {notice ? (
        <p className="form-error" role="alert">
          {notice}
        </p>
      ) : null}
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
