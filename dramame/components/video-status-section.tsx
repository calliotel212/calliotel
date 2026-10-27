"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GenerateVideoButton } from "@/components/generate-video-button";

const POLL_MS = 5000;
const ACTIVE_STATUSES = new Set(["queued", "generating", "assembling"]);

type VideoStatusName = "queued" | "generating" | "assembling" | "ready" | "failed";

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

export function VideoStatusSection({
  videoId,
  initialStatus,
  initialOutputUrl,
  initialError,
  children,
}: {
  videoId: string;
  initialStatus: VideoStatusName;
  initialOutputUrl: string | null;
  initialError: string | null;
  children?: ReactNode;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [outputUrl, setOutputUrl] = useState(initialOutputUrl);
  const [error, setError] = useState(initialError);

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

  return (
    <>
      <p className="lede" aria-live="polite">
        Status: {status}
      </p>
      {children}
      {status === "queued" ? <GenerateVideoButton videoId={videoId} /> : null}
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
    </>
  );
}
