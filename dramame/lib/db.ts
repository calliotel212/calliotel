import "server-only";

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const globalForDb = globalThis as unknown as { __dramameDb?: DatabaseSync };

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT,
      verification_expires INTEGER,
      reset_token TEXT,
      reset_expires INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_account_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      UNIQUE(provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS preferences (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      episode_alerts INTEGER NOT NULL DEFAULT 1,
      product_news INTEGER NOT NULL DEFAULT 0,
      security_email INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      series_id TEXT NOT NULL,
      highest_opened INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, series_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suggestions (
      id TEXT PRIMARY KEY,
      idea TEXT NOT NULL,
      email TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dev_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      email TEXT NOT NULL,
      kind TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_verification ON users(verification_token);
    CREATE INDEX IF NOT EXISTS idx_users_reset ON users(reset_token);
  `);
}

export function getDb(): DatabaseSync {
  if (!globalForDb.__dramameDb) {
    const dir = path.join(process.cwd(), "data");
    fs.mkdirSync(dir, { recursive: true });
    const db = new DatabaseSync(path.join(dir, "dramame.db"));
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    globalForDb.__dramameDb = db;
  }
  migrate(globalForDb.__dramameDb);
  return globalForDb.__dramameDb;
}
