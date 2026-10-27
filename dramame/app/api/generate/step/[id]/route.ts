import { NextResponse } from "next/server";
import { advanceGenerationStep, markGenerationFailed } from "@/lib/pipeline";
import { getCurrentUser } from "@/lib/session";
import { getVideoForUser } from "@/lib/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  try {
    const result = await advanceGenerationStep(video.id, { retry });
    return NextResponse.json(result, {
      status: result.status === "failed" ? 500 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Generation failed.");
    console.error(`POST /api/generate/step/${video.id} failed: ${message}`);
    try {
      await markGenerationFailed(video.id, message);
    } catch (updateError) {
      const updateMessage = redactSecrets(updateError instanceof Error ? updateError.message : "Could not store the failure.");
      console.error(`POST /api/generate/step/${video.id} could not mark the video failed: ${updateMessage}`);
    }
    return NextResponse.json(
      { id: video.id, status: "failed", error: message, outputUrl: null, remaining: 0, shot: null },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
