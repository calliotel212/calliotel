import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoStatusSection } from "@/components/video-status-section";
import { planLabel } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { formatWhen } from "@/lib/time";
import { getVideoForUser } from "@/lib/videos";

export const metadata: Metadata = { title: "Video" };
export const dynamic = "force-dynamic";

function when(ms: number) {
  return ms > 0 ? `${formatWhen(ms)} UTC` : "—";
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const video = await getVideoForUser(user.id, id);
  if (!video) notFound();

  return (
    <main className="page">
      <p className="eyebrow">Video</p>
      <h1>{planLabel(video.planId)}</h1>
      <VideoStatusSection
        key={`${video.updatedAt}:${video.status}:${video.outputUrl ?? ""}:${video.error ?? ""}`}
        videoId={video.id}
        initialStatus={video.status}
        initialOutputUrl={video.outputUrl}
        initialError={video.error}
        initialShots={video.shots.map((shot) => ({
          index: shot.index,
          prompt: shot.prompt,
          durationSeconds: shot.duration_seconds,
          status: shot.status,
          clipUrl: shot.clip_url,
          error: shot.error,
        }))}
      >
        <p>Created {when(video.createdAt)}.</p>
        {video.seriesId ? <p>Series {video.seriesId}</p> : null}
        <h2>Script</h2>
        <p className="script-block">{video.scriptText}</p>
      </VideoStatusSection>
      <p>
        <Link href="/account/videos">Back to videos</Link>
      </p>
    </main>
  );
}
