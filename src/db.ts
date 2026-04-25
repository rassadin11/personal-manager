import { DatabaseSync } from "node:sqlite";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.env.PM_DATA_DIR ?? join(homedir(), ".personal-manager");
mkdirSync(dir, { recursive: true });

export const db = new DatabaseSync(join(dir, "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT    NOT NULL,
    description TEXT,
    priority    TEXT NOT NULL DEFAULT 'medium',
    due_at      TEXT,
    status      TEXT NOT NULL DEFAULT 'pending',
    created_at  TEXT NOT NULL
  ) STRICT
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS reminders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    remind_at  TEXT NOT NULL,
    cron_id    TEXT,
    created_at TEXT NOT NULL
  ) STRICT
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS finances (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    type     TEXT NOT NULL,
    amount   REAL NOT NULL,
    category TEXT,
    comment  TEXT,
    date     TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    body       TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  ) STRICT
`);
