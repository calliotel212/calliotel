import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VideoStatusSection } from "@/components/video-status-section";
import { planLabel } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { formatWhen } from "@/lib/time";
import { getVideoForUser } from "@/lib/videos";

export const metadata: Metadata = { title: "Video" };

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
      >
        <p>Created {when(video.createdAt)}.</p>
        {video.seriesId ? <p>Series {video.seriesId}</p> : null}
        <h2>Script</h2>
        <p className="script-block">{video.scriptText}</p>
      </VideoStatusSection>
      <h2>Shot list</h2>
      {video.shots.length === 0 ? (
        <p>No shots yet.</p>
      ) : (
        <ol className="shot-list">
          {video.shots.map((shot) => (
            <li key={shot.index}>
              <p>{shot.prompt}</p>
              <p className="hint">
                {shot.duration_seconds} seconds{shot.status ? ` · ${shot.status}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
      <p>
        <Link href="/account/videos">Back to videos</Link>
      </p>
    </main>
  );
}
