import { randomUUID } from "node:crypto";

export type ShotDraft = {
  index: number;
  prompt: string;
  duration_seconds: number;
};

const SHOT_COUNT = 7;
const SHOT_SECONDS = 10;
const PLACEHOLDER_OUTPUT_URL = "placeholder://dramame/not-wired";

export function splitScriptToShots(script: string): ShotDraft[] {
  const text = script.trim().replace(/\s+/g, " ");
  const size = Math.max(1, Math.ceil((text.length || 1) / SHOT_COUNT));
  return Array.from({ length: SHOT_COUNT }, (_, offset) => {
    const slice = text.slice(offset * size, (offset + 1) * size).trim();
    return {
      index: offset + 1,
      prompt: slice || text || `Shot ${offset + 1}`,
      duration_seconds: SHOT_SECONDS,
    };
  });
}

type ScriptRow = {
  id?: string;
  script_text?: string | null;
};

export async function generateVideo(videoId: string): Promise<void> {
  const { getDb } = await import("@/lib/db");
  const db = getDb();
  const row = (await db.prepare("SELECT id, script_text FROM videos WHERE id = ?").get(videoId)) as ScriptRow | undefined;
  if (!row?.id) throw new Error("Video not found.");

  const touch = async (status: "generating" | "assembling" | "ready") => {
    console.log(status, videoId);
    if (status === "ready") {
      await db
        .prepare("UPDATE videos SET status = ?, output_url = ?, error = NULL, updated_at = ? WHERE id = ?")
        .run(status, PLACEHOLDER_OUTPUT_URL, Date.now(), videoId);
      return;
    }
    await db.prepare("UPDATE videos SET status = ?, updated_at = ? WHERE id = ?").run(status, Date.now(), videoId);
  };

  await touch("generating");

  const shots = splitScriptToShots(row.script_text ?? "");
  await db.prepare("UPDATE videos SET shot_list_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(shots), Date.now(), videoId);
  await db.prepare("DELETE FROM shots WHERE video_id = ?").run(videoId);
  for (const shot of shots) {
    await db
      .prepare(
        `INSERT INTO shots (id, video_id, "index", prompt, duration_seconds, status, clip_url, error)
         VALUES (?, ?, ?, ?, ?, 'queued', NULL, NULL)`,
      )
      .run(randomUUID(), videoId, shot.index, shot.prompt, shot.duration_seconds);
  }

  // Kling API call will go here.
  // Read KLING_API_KEY and KLING_API_BASE, request one clip per shot, and store clip_url.
  // Do not call Kling or any other video API from this function.

  await touch("assembling");
  await touch("ready");
}
