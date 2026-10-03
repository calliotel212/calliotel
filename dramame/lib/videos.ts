import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import type { PlanId } from "@/lib/plans";
import { asTimestamp } from "@/lib/time";

export const VIDEO_STATUSES = ["queued", "generating", "assembling", "ready", "failed"] as const;
export type VideoStatus = (typeof VIDEO_STATUSES)[number];

export type StoredShot = {
  index: number;
  prompt: string;
  duration_seconds: number;
  status: string | null;
  clip_url: string | null;
  error: string | null;
};

export type VideoRecord = {
  id: string;
  userId: string;
  seriesId: string | null;
  planId: string;
  scriptText: string;
  shots: StoredShot[];
  status: VideoStatus;
  outputUrl: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

type VideoRow = {
  id: string;
  user_id: string;
  series_id: string | null;
  plan_id: string;
  script_text: string;
  shot_list_json: string | null;
  status: string;
  output_url: string | null;
  error: string | null;
  created_at: number | string;
  updated_at: number | string;
};

type ShotRow = {
  shot_index: number | string;
  prompt: string;
  duration_seconds: number | string;
  status: string | null;
  clip_url: string | null;
  error: string | null;
};

function asStatus(value: string): VideoStatus {
  return VIDEO_STATUSES.find((status) => status === value) ?? "queued";
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function parseShotList(value: string | null): StoredShot[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    const shots: StoredShot[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const index = asNumber(record.index);
      const duration = asNumber(record.duration_seconds);
      if (index === null || !Number.isInteger(index)) continue;
      if (typeof record.prompt !== "string" || !record.prompt) continue;
      if (duration === null) continue;
      shots.push({
        index,
        prompt: record.prompt,
        duration_seconds: duration,
        status: typeof record.status === "string" ? record.status : null,
        clip_url: typeof record.clip_url === "string" ? record.clip_url : null,
        error: typeof record.error === "string" ? record.error : null,
      });
    }
    return shots.sort((a, b) => a.index - b.index);
  } catch {
    return [];
  }
}

function toShot(row: ShotRow): StoredShot | null {
  const index = asNumber(row.shot_index);
  const duration = asNumber(row.duration_seconds);
  if (index === null || !Number.isInteger(index) || duration === null || typeof row.prompt !== "string") return null;
  return {
    index,
    prompt: row.prompt,
    duration_seconds: duration,
    status: row.status,
    clip_url: row.clip_url,
    error: row.error,
  };
}

function toVideo(row: VideoRow, shots: StoredShot[]): VideoRecord {
  const fromTable = shots.length > 0 ? shots : parseShotList(row.shot_list_json);
  return {
    id: row.id,
    userId: row.user_id,
    seriesId: row.series_id,
    planId: row.plan_id,
    scriptText: row.script_text,
    shots: fromTable,
    status: asStatus(row.status),
    outputUrl: row.output_url,
    error: row.error,
    createdAt: asTimestamp(row.created_at) ?? 0,
    updatedAt: asTimestamp(row.updated_at) ?? 0,
  };
}

async function shotsFor(videoId: string): Promise<StoredShot[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT "index" AS shot_index, prompt, duration_seconds, status, clip_url, error
       FROM shots WHERE video_id = ? ORDER BY "index" ASC`,
    )
    .all(videoId)) as ShotRow[];
  return rows.flatMap((row) => {
    const shot = toShot(row);
    return shot ? [shot] : [];
  });
}

export async function createQueuedVideo(input: { userId: string; planId: PlanId; script: string }): Promise<string> {
  const id = randomUUID();
  const now = Date.now();
  await getDb()
    .prepare(
      `INSERT INTO videos (
        id, user_id, series_id, plan_id, script_text, shot_list_json, status, output_url, error, created_at, updated_at
      ) VALUES (?, ?, NULL, ?, ?, NULL, 'queued', NULL, NULL, ?, ?)`,
    )
    .run(id, input.userId, input.planId, input.script.trim(), now, now);
  return id;
}

export async function listVideosForUser(userId: string): Promise<VideoRecord[]> {
  const rows = (await getDb()
    .prepare(
      `SELECT id, user_id, series_id, plan_id, script_text, shot_list_json, status, output_url, error, created_at, updated_at
       FROM videos WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId)) as VideoRow[];
  const videos: VideoRecord[] = [];
  for (const row of rows) {
    videos.push(toVideo(row, await shotsFor(row.id)));
  }
  return videos;
}

export async function getVideoForUser(userId: string, videoId: string): Promise<VideoRecord | null> {
  const row = (await getDb()
    .prepare(
      `SELECT id, user_id, series_id, plan_id, script_text, shot_list_json, status, output_url, error, created_at, updated_at
       FROM videos WHERE id = ? AND user_id = ?`,
    )
    .get(videoId, userId)) as VideoRow | undefined;
  if (!row) return null;
  return toVideo(row, await shotsFor(row.id));
}
