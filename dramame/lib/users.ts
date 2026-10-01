import "server-only";

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { isDevRuntime } from "@/lib/form-state";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { OAuthProvider } from "@/lib/social";
import { hashToken, newToken } from "@/lib/tokens";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string | null;
  emailVerified: boolean;
  createdAt: number;
};

type UserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  email_verified: number;
  verification_token: string | null;
  verification_expires: number | null;
  reset_token: string | null;
  reset_expires: number | null;
  created_at: number;
  updated_at: number;
};

export type Preferences = {
  episodeAlerts: boolean;
  productNews: boolean;
  securityEmail: boolean;
  autoPostConfirmations: boolean;
};

const VERIFY_TTL = 24 * 60 * 60 * 1000;
const RESET_TTL = 60 * 60 * 1000;

function asRow(row: unknown): UserRow | null {
  if (!row || typeof row !== "object") return null;
  return row as UserRow;
}

function toUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: row.email_verified === 1,
    createdAt: row.created_at,
  };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const row = asRow(await getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()));
  return row ? toUser(row) : null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const row = asRow(await getDb().prepare("SELECT * FROM users WHERE id = ?").get(id));
  return row ? toUser(row) : null;
}

export async function findUserByProvider(provider: string, providerAccountId: string): Promise<UserRecord | null> {
  const link = await getDb()
    .prepare("SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?")
    .get(provider, providerAccountId) as { user_id?: string } | undefined;
  if (!link?.user_id) return null;
  return await findUserById(link.user_id);
}

async function storeVerification(userId: string, now: number): Promise<string> {
  const token = newToken();
  await getDb()
    .prepare("UPDATE users SET verification_token = ?, verification_expires = ?, updated_at = ? WHERE id = ?")
    .run(hashToken(token), now + VERIFY_TTL, now, userId);
  return token;
}

export async function createUser(input: { name: string; email: string; password: string }): Promise<{ user: UserRecord; verifyToken: string }> {
  const now = Date.now();
  const id = randomUUID();
  const email = input.email.trim().toLowerCase();
  const token = newToken();
  const db = getDb();
  await db.prepare(
    `INSERT INTO users (
      id, name, email, password_hash, email_verified, verification_token, verification_expires, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)`,
  ).run(id, input.name.trim(), email, hashPassword(input.password), hashToken(token), now + VERIFY_TTL, now, now);
  await db.prepare(
    "INSERT INTO preferences (user_id, episode_alerts, product_news, security_email) VALUES (?, 1, 0, 1)",
  ).run(id);
  const user = await findUserById(id);
  if (!user) throw new Error("Could not create the account.");
  return { user, verifyToken: token };
}

export async function authenticate(email: string, password: string): Promise<{ status: "ok"; user: UserRecord } | { status: "unknown" } | { status: "wrong" } | { status: "social" }> {
  const row = asRow(await getDb().prepare("SELECT * FROM users WHERE email = ?").get(email.trim().toLowerCase()));
  if (!row) return { status: "unknown" };
  if (!row.password_hash) return { status: "social" };
  if (!verifyPassword(password, row.password_hash)) return { status: "wrong" };
  return { status: "ok", user: toUser(row) };
}

export async function recordDevLink(input: { userId: string; email: string; kind: "verify" | "reset"; url: string }) {
  if (!isDevRuntime()) return;
  console.info(`[dramame] ${input.kind} link for ${input.email}: ${input.url}`);
  const db = getDb();
  await db.prepare("DELETE FROM dev_links WHERE user_id = ? AND kind = ?").run(input.userId, input.kind);
  await db.prepare("INSERT INTO dev_links (user_id, email, kind, url, created_at) VALUES (?, ?, ?, ?, ?)").run(
    input.userId,
    input.email,
    input.kind,
    input.url,
    Date.now(),
  );
}

export async function latestDevLink(userId: string, kind: "verify" | "reset"): Promise<string | null> {
  if (!isDevRuntime()) return null;
  const row = await getDb()
    .prepare("SELECT url FROM dev_links WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT 1")
    .get(userId, kind) as { url?: string } | undefined;
  return row?.url ?? null;
}

export async function verifyEmailToken(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = asRow(await getDb().prepare("SELECT * FROM users WHERE verification_token = ?").get(hashToken(token)));
  if (!row || !row.verification_expires) return { ok: false, error: "This verification link is invalid or expired." };
  if (row.verification_expires < Date.now()) return { ok: false, error: "This verification link has expired." };
  await getDb()
    .prepare("UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL, updated_at = ? WHERE id = ?")
    .run(Date.now(), row.id);
  return { ok: true };
}

export async function resendVerification(userId: string): Promise<{ ok: true; token: string; email: string } | { ok: false; error: string }> {
  const user = await findUserById(userId);
  if (!user) return { ok: false, error: "Account not found." };
  if (user.emailVerified) return { ok: false, error: "This email is already verified." };
  const token = await storeVerification(user.id, Date.now());
  return { ok: true, token, email: user.email };
}

export async function createResetToken(email: string): Promise<{ ok: true; token: string; user: UserRecord } | { ok: false; error: string }> {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, error: "No account uses that email." };
  const token = newToken();
  const now = Date.now();
  await getDb()
    .prepare("UPDATE users SET reset_token = ?, reset_expires = ?, updated_at = ? WHERE id = ?")
    .run(hashToken(token), now + RESET_TTL, now, user.id);
  return { ok: true, token, user };
}

export async function resetPassword(token: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = asRow(await getDb().prepare("SELECT * FROM users WHERE reset_token = ?").get(hashToken(token)));
  if (!row || !row.reset_expires) return { ok: false, error: "This reset link is invalid or expired." };
  if (row.reset_expires < Date.now()) return { ok: false, error: "This reset link has expired." };
  await getDb()
    .prepare("UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires = NULL, updated_at = ? WHERE id = ?")
    .run(hashPassword(password), Date.now(), row.id);
  return { ok: true };
}

export async function updateProfile(userId: string, input: { name: string; email: string }): Promise<{ ok: true; verifyToken?: string; email: string } | { ok: false; error: string }> {
  const user = await findUserById(userId);
  if (!user) return { ok: false, error: "Account not found." };
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing && existing.id !== userId) return { ok: false, error: "An account already uses that email." };
  const now = Date.now();
  if (email === user.email) {
    await getDb().prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run(input.name.trim(), now, userId);
    return { ok: true, email };
  }
  const token = newToken();
  await getDb()
    .prepare(
      `UPDATE users
       SET name = ?, email = ?, email_verified = 0, verification_token = ?, verification_expires = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(input.name.trim(), email, hashToken(token), now + VERIFY_TTL, now, userId);
  return { ok: true, verifyToken: token, email };
}

export async function changePassword(userId: string, input: { current: string; next: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = asRow(await getDb().prepare("SELECT * FROM users WHERE id = ?").get(userId));
  if (!row) return { ok: false, error: "Account not found." };
  if (row.password_hash) {
    if (!input.current) return { ok: false, error: "Enter your current password." };
    if (!verifyPassword(input.current, row.password_hash)) return { ok: false, error: "That password doesn’t match." };
  }
  await getDb().prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(hashPassword(input.next), Date.now(), userId);
  return { ok: true };
}

const EMPTY_PREFERENCES: Preferences = {
  episodeAlerts: true,
  productNews: false,
  securityEmail: true,
  autoPostConfirmations: false,
};

export async function getPreferences(userId: string): Promise<Preferences> {
  const row = await getDb()
    .prepare("SELECT episode_alerts, product_news, security_email, auto_post_confirmations FROM preferences WHERE user_id = ?")
    .get(userId) as
    | { episode_alerts: number; product_news: number; security_email: number; auto_post_confirmations: number }
    | undefined;
  if (!row) return EMPTY_PREFERENCES;
  return {
    episodeAlerts: row.episode_alerts === 1,
    productNews: row.product_news === 1,
    securityEmail: row.security_email === 1,
    autoPostConfirmations: row.auto_post_confirmations === 1,
  };
}

export async function savePreferences(userId: string, prefs: Preferences) {
  await getDb()
    .prepare(
      `INSERT INTO preferences (user_id, episode_alerts, product_news, security_email, auto_post_confirmations)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         episode_alerts = excluded.episode_alerts,
         product_news = excluded.product_news,
         security_email = excluded.security_email,
         auto_post_confirmations = excluded.auto_post_confirmations`,
    )
    .run(
      userId,
      prefs.episodeAlerts ? 1 : 0,
      prefs.productNews ? 1 : 0,
      prefs.securityEmail ? 1 : 0,
      prefs.autoPostConfirmations ? 1 : 0,
    );
}

export async function listOAuth(userId: string): Promise<{ provider: string }[]> {
  return await getDb().prepare("SELECT provider FROM oauth_accounts WHERE user_id = ?").all(userId) as { provider: string }[];
}

export async function disconnectProvider(userId: string, provider: OAuthProvider): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await findUserById(userId);
  if (!user) return { ok: false, error: "Account not found." };
  const linked = (await listOAuth(userId)).filter((row) => row.provider !== provider);
  if (!user.passwordHash && linked.length === 0) {
    return { ok: false, error: "Add a password before disconnecting your only sign-in method." };
  }
  await getDb().prepare("DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?").run(userId, provider);
  return { ok: true };
}

export async function upsertOAuthUser(input: { email: string; name: string; provider: OAuthProvider; providerAccountId: string }): Promise<UserRecord> {
  const existingLink = await findUserByProvider(input.provider, input.providerAccountId);
  if (existingLink) return existingLink;

  const email = input.email.trim().toLowerCase();
  const now = Date.now();
  let user = await findUserByEmail(email);
  const db = getDb();
  if (!user) {
    const id = randomUUID();
    await db.prepare(
      `INSERT INTO users (id, name, email, password_hash, email_verified, created_at, updated_at)
       VALUES (?, ?, ?, NULL, 1, ?, ?)`,
    ).run(id, input.name.trim() || "Viewer", email, now, now);
    await db.prepare("INSERT INTO preferences (user_id, episode_alerts, product_news, security_email) VALUES (?, 1, 0, 1)").run(id);
    user = await findUserById(id);
  } else if (!user.emailVerified) {
    await db.prepare("UPDATE users SET email_verified = 1, verification_token = NULL, verification_expires = NULL, updated_at = ? WHERE id = ?").run(now, user.id);
    user = (await findUserById(user.id)) ?? user;
  }
  if (!user) throw new Error("Could not link the social account.");

  const already = await db
    .prepare("SELECT id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?")
    .get(input.provider, input.providerAccountId);
  if (!already) {
    await db.prepare("INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, created_at) VALUES (?, ?, ?, ?, ?)").run(
      randomUUID(),
      user.id,
      input.provider,
      input.providerAccountId,
      now,
    );
  }
  return user;
}

export async function deleteUser(userId: string) {
  const db = getDb();
  const user = await findUserById(userId);
  const email = user?.email.trim().toLowerCase();
  await db.exec("BEGIN");
  try {
    if (email) {
      await db.prepare("DELETE FROM suggestions WHERE email IS NOT NULL AND lower(email) = ?").run(email);
      await db.prepare("DELETE FROM messages WHERE lower(email) = ?").run(email);
    }
    await db.prepare("DELETE FROM users WHERE id = ?").run(userId);
    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    throw error;
  }
}

export type StoredMessage = {
  id: string;
  name: string;
  email: string;
  body: string;
  createdAt: number;
};

export type StoredSuggestion = {
  id: string;
  idea: string;
  email: string | null;
  createdAt: number;
};

export async function listMessages(): Promise<StoredMessage[]> {
  const rows = await getDb()
    .prepare("SELECT id, name, email, body, created_at FROM messages ORDER BY created_at DESC")
    .all() as { id: string; name: string; email: string; body: string; created_at: number }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function listSuggestions(): Promise<StoredSuggestion[]> {
  const rows = await getDb()
    .prepare("SELECT id, idea, email, created_at FROM suggestions ORDER BY created_at DESC")
    .all() as { id: string; idea: string; email: string | null; created_at: number }[];
  return rows.map((row) => ({
    id: row.id,
    idea: row.idea,
    email: row.email,
    createdAt: row.created_at,
  }));
}

export async function saveMessage(input: { name: string; email: string; message: string }) {
  await getDb()
    .prepare("INSERT INTO messages (id, name, email, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), input.name.trim(), input.email.trim().toLowerCase(), input.message.trim(), Date.now());
}

export async function saveSuggestion(input: { idea: string; email: string }) {
  const email = input.email.trim().toLowerCase();
  await getDb()
    .prepare("INSERT INTO suggestions (id, idea, email, created_at) VALUES (?, ?, ?, ?)")
    .run(randomUUID(), input.idea.trim(), email || null, Date.now());
}

export async function getProgress(userId: string, seriesId: string): Promise<number> {
  const row = await getDb()
    .prepare("SELECT highest_opened FROM progress WHERE user_id = ? AND series_id = ?")
    .get(userId, seriesId) as { highest_opened?: number } | undefined;
  return row?.highest_opened ?? 0;
}

export async function saveProgress(userId: string, seriesId: string, highestOpened: number) {
  const current = await getProgress(userId, seriesId);
  const next = Math.max(current, highestOpened);
  await getDb()
    .prepare(
      `INSERT INTO progress (user_id, series_id, highest_opened, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, series_id) DO UPDATE SET
         highest_opened = excluded.highest_opened,
         updated_at = excluded.updated_at`,
    )
    .run(userId, seriesId, next, Date.now());
}
