import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { claimGeneration, markGenerationFailed, resumeGeneration, runBackgroundShotLoop } from "@/lib/pipeline";
import { getCurrentUser } from "@/lib/session";
import { getVideoForUser } from "@/lib/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Pro background limit is 15 minutes. Per-function max duration allows this (extended limit is 30 minutes).
export const maxDuration = 900;

function redactSecrets(value: string): string {
  let text = value.replace(/\b(Bearer|Key)\s+\S+/gi, "$1 [redacted]");
  for (const name of ["ELEVENLABS_API_KEY", "FAL_API_KEY", "KLING_API_KEY", "AUTH_SECRET", "DATABASE_URL", "RESEND_API_KEY"]) {
    const secret = process.env[name]?.trim();
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text.replace(/\s+/g, " ").slice(0, 500);
}

async function wantsRetry(request: Request): Promise<boolean> {
  const text = await request.text();
  if (!text.trim()) return false;
  try {
    const body = JSON.parse(text) as { retry?: unknown };
    return Boolean(body && typeof body === "object" && body.retry === true);
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  if (!id?.trim()) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const video = await getVideoForUser(user.id, id);
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const retry = await wantsRetry(request);
  const noStore = { "Cache-Control": "no-store" };

  let lockToken: string | null = null;
  let backgroundRetry = false;

  if (video.status === "generating" || video.status === "assembling") {
    try {
      const resume = await resumeGeneration(video.id);
      if (!resume.ok) {
        return NextResponse.json({ error: resume.message, message: resume.message }, { status: 400, headers: noStore });
      }
      lockToken = resume.lockToken;
      // A reload must not requeue. retry: false leaves a generating shot generating.
      backgroundRetry = false;
    } catch (error) {
      const message = redactSecrets(error instanceof Error ? error.message : "Generation failed.");
      console.error(`POST /api/generate/background/${video.id} failed: ${message}`);
      return NextResponse.json(
        { id: video.id, status: video.status, error: message, message },
        { status: 500, headers: noStore },
      );
    }
  } else if (video.status !== "queued" && video.status !== "failed") {
    const message = video.status === "ready" ? "Video is already ready." : "Video cannot be generated right now.";
    return NextResponse.json({ error: message, message }, { status: 400, headers: noStore });
  }

  try {
    if (!lockToken) {
      const claim = await claimGeneration(video.id);
      if (!claim.ok) {
        return NextResponse.json({ error: claim.message, message: claim.message }, { status: 400, headers: noStore });
      }
      lockToken = claim.lockToken;
      backgroundRetry = retry || claim.previousStatus === "failed";
    }

    // This uses Vercel's `waitUntil` so the client does not have to keep the tab open.
    // Resume passes retry: false so a generating shot is not reset to queued.
    waitUntil(runBackgroundShotLoop(video.id, { retry: backgroundRetry, lockToken }));

    return NextResponse.json({ id: video.id, status: "generating" }, { status: 200, headers: noStore });
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Generation failed.");
    console.error(`POST /api/generate/background/${video.id} failed: ${message}`);
    if (video.status !== "generating" && video.status !== "assembling") {
      try {
        await markGenerationFailed(video.id, message);
      } catch (updateError) {
        const updateMessage = redactSecrets(updateError instanceof Error ? updateError.message : "Could not store the failure.");
        console.error(`POST /api/generate/background/${video.id} could not mark the video failed: ${updateMessage}`);
      }
    }
    const reportedStatus = video.status === "generating" || video.status === "assembling" ? video.status : "failed";
    return NextResponse.json(
      { id: video.id, status: reportedStatus, error: message, message },
      { status: 500, headers: noStore },
    );
  }
}
