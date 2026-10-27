import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { getVideoStatusForUser } from "@/lib/videos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await params;
  if (!id?.trim()) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const video = await getVideoStatusForUser(user.id, id);
  if (!video) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  return NextResponse.json(
    {
      id: video.id,
      status: video.status,
      outputUrl: video.outputUrl,
      error: video.error,
      shots: video.shots.map((shot) => ({
        index: shot.index,
        prompt: shot.prompt,
        durationSeconds: shot.duration_seconds,
        status: shot.status,
        clipUrl: shot.clip_url,
        error: shot.error,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
