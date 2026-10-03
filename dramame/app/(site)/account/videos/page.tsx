import type { Metadata } from "next";
import Link from "next/link";
import { CreateVideoForm } from "@/components/create-video-form";
import { planLabel } from "@/lib/plans";
import { requireUser } from "@/lib/session";
import { formatWhen } from "@/lib/time";
import { listVideosForUser } from "@/lib/videos";

export const metadata: Metadata = { title: "Videos" };

function when(ms: number) {
  return ms > 0 ? `${formatWhen(ms)} UTC` : "—";
}

export default async function VideosPage() {
  const user = await requireUser();
  const videos = await listVideosForUser(user.id);
  return (
    <main className="page">
      <h1>Videos</h1>
      <p className="lede">Scripts you saved. A new video stays queued until generation is wired.</p>
      {videos.length === 0 ? (
        <p>No videos yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Status</th>
                <th>Created</th>
                <th>Video</th>
              </tr>
            </thead>
            <tbody>
              {videos.map((video) => (
                <tr key={video.id}>
                  <td>{planLabel(video.planId)}</td>
                  <td>{video.status}</td>
                  <td>{when(video.createdAt)}</td>
                  <td>
                    <Link href={`/account/videos/${video.id}`}>View video</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <section className="panel">
        <h2>Create a video</h2>
        <CreateVideoForm />
      </section>
    </main>
  );
}
