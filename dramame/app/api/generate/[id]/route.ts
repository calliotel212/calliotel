import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import { getCurrentUser } from "@/lib/session";
import { getVideoForUser } from "@/lib/videos";

export const runtime = "nodejs";
export const maxDuration = 300;

function redactSecrets(value: string): string {
  let text = value;
  for (const name of ["ELEVENLABS_API_KEY", "FAL_API_KEY"]) {
    const secret = process.env[name]?.trim();
    if (secret) text = text.split(secret).join("[redacted]");
  }
  return text.slice(0, 500);
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  if (!id?.trim()) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const video = await getVideoForUser(user.id, id);
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  try {
    await runPipeline(video.id);
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Pipeline failed.");
    console.error(`POST /api/generate/${video.id} failed: ${message}`);
    return NextResponse.json({ id: video.id, status: "failed", error: "Pipeline failed." }, { status: 500 });
  }

  const updated = await getVideoForUser(user.id, video.id);
  return NextResponse.json({
    id: video.id,
    status: updated?.status ?? "failed",
    error: updated?.error ?? null,
  });
}
