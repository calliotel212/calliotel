import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { PREVIEW_EPISODES } from "@/lib/episodes";
import { autoPostProviderLabel, isAutoPostProvider, type AutoPostProvider } from "@/lib/social";

export type SocialAccountSummary = {
  id: string;
  provider: AutoPostProvider;
  handle: string | null;
};

export type PostQueueStatus = "draft" | "approved" | "posted" | "failed";

export type PostQueueItem = {
  id: string;
  episodeId: string;
  episodeLabel: string;
  provider: AutoPostProvider;
  providerLabel: string;
  caption: string;
  scheduledAt: number;
  status: PostQueueStatus;
};

const STATUSES: readonly PostQueueStatus[] = ["draft", "approved", "posted", "failed"];

function isStatus(value: string): value is PostQueueStatus {
  return (STATUSES as readonly string[]).includes(value);
}

function episodeLabel(episodeId: string): string {
  const episode = PREVIEW_EPISODES.find((item) => String(item.number) === episodeId);
  return episode ? `Episode ${episode.number}: ${episode.title}` : episodeId;
}

export function isPreviewEpisodeId(episodeId: string): boolean {
  return PREVIEW_EPISODES.some((episode) => String(episode.number) === episodeId);
}

export async function listSocialAccounts(userId: string): Promise<SocialAccountSummary[]> {
  const rows = await getDb()
    .prepare("SELECT id, provider, handle FROM social_accounts WHERE user_id = ? ORDER BY provider")
    .all(userId) as { id: string; provider: string; handle: string | null }[];
  return rows.flatMap((row) => {
    if (!isAutoPostProvider(row.provider)) return [];
    return [{ id: row.id, provider: row.provider, handle: row.handle }];
  });
}

export async function listPostQueue(userId: string): Promise<PostQueueItem[]> {
  const rows = await getDb()
    .prepare(
      `SELECT id, episode_id, provider, caption, scheduled_at, status
       FROM post_queue
       WHERE user_id = ?
       ORDER BY scheduled_at ASC, created_at ASC`,
    )
    .all(userId) as {
    id: string;
    episode_id: string;
    provider: string;
    caption: string;
    scheduled_at: number;
    status: string;
  }[];
  return rows.flatMap((row) => {
    if (!isAutoPostProvider(row.provider) || !isStatus(row.status)) return [];
    return [
      {
        id: row.id,
        episodeId: row.episode_id,
        episodeLabel: episodeLabel(row.episode_id),
        provider: row.provider,
        providerLabel: autoPostProviderLabel(row.provider),
        caption: row.caption,
        scheduledAt: row.scheduled_at,
        status: row.status,
      },
    ];
  });
}

export async function addPostQueueItem(input: {
  userId: string;
  episodeId: string;
  provider: AutoPostProvider;
  caption: string;
  scheduledAt: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isPreviewEpisodeId(input.episodeId)) return { ok: false, error: "Choose an episode." };
  const now = Date.now();
  await getDb()
    .prepare(
      `INSERT INTO post_queue (
        id, user_id, episode_id, provider, caption, scheduled_at, status, external_post_id, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'draft', NULL, NULL, ?, ?)`,
    )
    .run(randomUUID(), input.userId, input.episodeId, input.provider, input.caption, input.scheduledAt, now, now);
  return { ok: true };
}

export async function approvePostQueueItem(userId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await getDb()
    .prepare("UPDATE post_queue SET status = 'approved', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'draft'")
    .run(Date.now(), id, userId);
  if (result.changes !== 1) return { ok: false, error: "Only a draft can be approved." };
  return { ok: true };
}

export async function removePostQueueItem(userId: string, id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await getDb()
    .prepare("DELETE FROM post_queue WHERE id = ? AND user_id = ? AND status = 'draft'")
    .run(id, userId);
  if (result.changes !== 1) return { ok: false, error: "Only a draft can be removed." };
  return { ok: true };
}
