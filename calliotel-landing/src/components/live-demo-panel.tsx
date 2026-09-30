"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useConnectionState,
  useLocalParticipant,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

type DemoSession = {
  serverUrl: string;
  token: string;
  roomName: string;
  maxSeconds: number;
};

type PanelPhase = "idle" | "connecting" | "live" | "error";

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ActiveDemoControls({
  maxSeconds,
  onEnd,
}: {
  maxSeconds: number;
  onEnd: () => void;
}) {
  const connectionState = useConnectionState();
  const { localParticipant } = useLocalParticipant();
  const [remaining, setRemaining] = useState(maxSeconds);
  const [micOn, setMicOn] = useState(true);

  useEffect(() => {
    if (connectionState !== ConnectionState.Connected) return;

    const deadline = Date.now() + maxSeconds * 1000;
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) onEnd();
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [connectionState, maxSeconds, onEnd]);

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    const next = !micOn;
    await localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [localParticipant, micOn]);

  const connected = connectionState === ConnectionState.Connected;

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <RoomAudioRenderer />
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full border-2 ${
          connected
            ? "border-emerald-500/60 bg-emerald-950/40"
            : "border-amber-500/50 bg-amber-950/30"
        }`}
        aria-hidden
      >
        <span
          className={`h-3 w-3 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-amber-400"}`}
        />
      </div>
      <p className="text-center text-sm text-slate-300">
        {connected
          ? "Connected — speak in Arabic or English. The AI receptionist will respond."
          : "Connecting to LiveKit… allow microphone access when prompted."}
      </p>
      <p className="font-mono text-xs text-slate-500">
        Time remaining: {formatCountdown(remaining)}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => void toggleMic()}
          disabled={!connected}
          className="rounded-lg border border-slate-600 bg-navy-900 px-4 py-2 text-sm font-medium text-slate-200 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {micOn ? "Mute microphone" : "Unmute microphone"}
        </button>
        <button
          type="button"
          onClick={onEnd}
          className="rounded-lg bg-rose-700/90 px-4 py-2 text-sm font-medium text-white hover:bg-rose-600"
        >
          End call
        </button>
      </div>
    </div>
  );
}

export function LiveDemoPanel() {
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [session, setSession] = useState<DemoSession | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const endCall = useCallback(() => {
    setSession(null);
    setPhase("idle");
    setErrorMessage(null);
  }, []);

  const startCall = useCallback(async () => {
    setErrorMessage(null);
    setPhase("connecting");

    try {
      const res = await fetch("/api/livekit/token", { method: "POST" });
      const data = (await res.json()) as DemoSession & { error?: string };

      if (!res.ok) {
        setErrorMessage(
          data.error ??
            (res.status === 503
              ? "Voice demo is not available on this server yet."
              : "Could not start the demo."),
        );
        setPhase("error");
        return;
      }

      setSession({
        serverUrl: data.serverUrl,
        token: data.token,
        roomName: data.roomName,
        maxSeconds: data.maxSeconds,
      });
      setPhase("live");
    } catch {
      setErrorMessage("Network error — check your connection and try again.");
      setPhase("error");
    }
  }, []);

  return (
    <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-slate-700/80 bg-navy-800/60 p-8 shadow-xl">
      {phase === "live" && session ? (
        <LiveKitRoom
          serverUrl={session.serverUrl}
          token={session.token}
          connect
          audio
          video={false}
          onDisconnected={endCall}
          onError={(err) => {
            console.error("[LiveDemo]", err);
            setErrorMessage(err.message || "LiveKit connection failed.");
            endCall();
            setPhase("error");
          }}
          className="w-full"
        >
          <ActiveDemoControls maxSeconds={session.maxSeconds} onEnd={endCall} />
        </LiveKitRoom>
      ) : (
        <div className="flex flex-col items-center gap-6">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-dashed border-slate-600 bg-navy-950/80"
            aria-hidden
          >
            <svg
              className="h-10 w-10 text-teal-500/80"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 18.75a6.75 6.75 0 006.75-6.75v-1.5m-6.75 7.5a6.75 6.75 0 01-6.75-6.75v-1.5m6.75 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
              />
            </svg>
          </div>

          {phase === "error" && errorMessage ? (
            <p className="text-center text-sm text-rose-300" role="alert">
              {errorMessage}
            </p>
          ) : (
            <p className="text-center text-sm text-slate-400">
              {phase === "connecting"
                ? "Starting a private demo room…"
                : "Start a short browser call to our sample AI receptionist (mic required)."}
            </p>
          )}

          <button
            type="button"
            onClick={() => void startCall()}
            disabled={phase === "connecting"}
            className="rounded-lg bg-teal-600 px-6 py-3 text-sm font-medium text-white hover:bg-teal-500 disabled:cursor-wait disabled:opacity-70"
          >
            {phase === "connecting" ? "Connecting…" : "Start voice call"}
          </button>
        </div>
      )}
    </div>
  );
}
