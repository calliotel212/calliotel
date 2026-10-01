import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { autoPostProviderLabel } from "@/lib/social";
import { asTimestamp } from "@/lib/time";

export type QueueStatus = "draft" | "approved" | "posted" | "failed";

export type AdminCounts = {
  users: number;
  verifiedUsers: number;
  suggestions: number;
  messages: number;
  requests: number;
  queue: Record<QueueStatus, number>;
};

export type AdminUser = {
  id: string;
  email: string;
  verified: boolean;
  createdAt: number;
  lastLogin: number | null;
};

export type AdminQueueRow = {
  id: string;
  email: string;
  provider: string;
  status: string;
  scheduledAt: number;
  error: string | null;
};

export type StudioRequest = {
  id: string;
  name: string;
  email: string;
  idea: string;
  createdAt: number;
  readAt: number | null;
};

const QUEUE_STATUSES: readonly QueueStatus[] = ["draft", "approved", "posted", "failed"];
const READ_TABLES = {
  messages: "messages",
  suggestions: "suggestions",
  studio_requests: "studio_requests",
} as const;

export type InboxTable = keyof typeof READ_TABLES;

const LAST_LOGIN_KEYS = ["last_login", "last_login_at"] as const;

function countValue(value: unknown): number {
  const parsed = asTimestamp(value);
  if (parsed !== null) return parsed;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (value === 0 || value === "0") return 0;
  return 0;
}

function likeContains(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function storedLastLogin(row: Record<string, unknown>): number | null {
  for (const key of LAST_LOGIN_KEYS) {
    if (!(key in row)) continue;
    const stored = asTimestamp(row[key]);
    if (stored !== null) return stored;
  }
  return null;
}

function providerLabel(provider: string): string {
  if (provider === "tiktok" || provider === "instagram") return autoPostProviderLabel(provider);
  return provider;
}

export async function adminCounts(): Promise<AdminCounts> {
  const db = getDb();
  const totals = await db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM users WHERE email_verified = 1) AS verified_users,
        (SELECT COUNT(*) FROM suggestions) AS suggestions,
        (SELECT COUNT(*) FROM messages) AS messages,
        (SELECT COUNT(*) FROM studio_requests) AS requests`,
    )
    .get() as Record<string, unknown> | undefined;
  const queueRows = await db
    .prepare("SELECT status, COUNT(*) AS count FROM post_queue GROUP BY status")
    .all() as { status?: string; count?: unknown }[];
  const queue: Record<QueueStatus, number> = { draft: 0, approved: 0, posted: 0, failed: 0 };
  for (const row of queueRows) {
    const status = row.status;
    if (status && (QUEUE_STATUSES as readonly string[]).includes(status)) {
      queue[status as QueueStatus] = countValue(row.count);
    }
  }
  return {
    users: countValue(totals?.users),
    verifiedUsers: countValue(totals?.verified_users),
    suggestions: countValue(totals?.suggestions),
    messages: countValue(totals?.messages),
    requests: countValue(totals?.requests),
    queue,
  };
}

export async function listAdminUsers(query: string): Promise<AdminUser[]> {
  const q = query.trim().toLowerCase();
  const sql = q
    ? "SELECT * FROM users WHERE lower(email) LIKE ? ESCAPE '\\' ORDER BY created_at DESC"
    : "SELECT * FROM users ORDER BY created_at DESC";
  const rows = await getDb().prepare(sql).all(...(q ? [likeContains(q)] : []));
  return rows.map((row) => {
    const record = row as Record<string, unknown>;
    return {
      id: String(record.id ?? ""),
      email: String(record.email ?? ""),
      verified: Number(record.email_verified) === 1,
      createdAt: asTimestamp(record.created_at) ?? 0,
      lastLogin: storedLastLogin(record),
    };
  });
}

export async function listAdminQueue(): Promise<AdminQueueRow[]> {
  const rows = await getDb()
    .prepare(
      `SELECT q.id, u.email, q.provider, q.status, q.scheduled_at, q.error
       FROM post_queue q
       JOIN users u ON u.id = q.user_id
       ORDER BY q.scheduled_at DESC, q.created_at DESC`,
    )
    .all() as {
    id: string;
    email: string;
    provider: string;
    status: string;
    scheduled_at: number;
    error: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    provider: providerLabel(row.provider),
    status: row.status,
    scheduledAt: asTimestamp(row.scheduled_at) ?? 0,
    error: typeof row.error === "string" && row.error.trim() ? row.error : null,
  }));
}

export async function listStudioRequests(): Promise<StudioRequest[]> {
  const rows = await getDb()
    .prepare("SELECT id, name, email, idea, created_at, read_at FROM studio_requests ORDER BY created_at DESC")
    .all() as {
    id: string;
    name: string;
    email: string;
    idea: string;
    created_at: number;
    read_at: number | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    idea: row.idea,
    createdAt: asTimestamp(row.created_at) ?? 0,
    readAt: asTimestamp(row.read_at),
  }));
}

export async function saveStudioRequest(input: { name: string; email: string; idea: string }) {
  await getDb()
    .prepare("INSERT INTO studio_requests (id, name, email, idea, created_at, read_at) VALUES (?, ?, ?, ?, ?, NULL)")
    .run(randomUUID(), input.name.trim(), input.email.trim().toLowerCase(), input.idea.trim(), Date.now());
}

export async function setInboxRead(table: InboxTable, id: string, read: boolean) {
  const name = READ_TABLES[table];
  await getDb().prepare(`UPDATE ${name} SET read_at = ? WHERE id = ?`).run(read ? Date.now() : null, id);
}
