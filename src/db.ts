import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DB_DIR = path.join(os.homedir(), ".openclaw", "shippulse");
const DB_PATH = path.join(DB_DIR, "shippulse.db");

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;

  fs.mkdirSync(DB_DIR, { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec("PRAGMA journal_mode=WAL");
  _db.exec("PRAGMA foreign_keys=ON");
  migrate(_db);
  return _db;
}

function resequenceRunNumbers(db: DatabaseSync): void {
  const runs = db.prepare("SELECT id FROM runs ORDER BY created_at ASC, id ASC").all() as Array<{ id: string }>;
  const update = db.prepare("UPDATE runs SET run_number = ? WHERE id = ?");
  for (let i = 0; i < runs.length; i++) {
    update.run(i + 1, runs[i].id);
  }
}

function ensureRunNumbers(db: DatabaseSync): void {
  const nulls = db.prepare("SELECT COUNT(*) as cnt FROM runs WHERE run_number IS NULL").get() as { cnt: number };
  const dupes = db.prepare(`
    SELECT COUNT(*) as cnt FROM (
      SELECT run_number
      FROM runs
      WHERE run_number IS NOT NULL
      GROUP BY run_number
      HAVING COUNT(*) > 1
    )
  `).get() as { cnt: number };
  if ((nulls.cnt ?? 0) > 0 || (dupes.cnt ?? 0) > 0) {
    resequenceRunNumbers(db);
  }
}

function dedupeStories(db: DatabaseSync): void {
  db.exec(`
    DELETE FROM stories
    WHERE rowid NOT IN (
      SELECT MIN(rowid)
      FROM stories
      GROUP BY run_id, story_id
    )
  `);
}

function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      workflow_id TEXT NOT NULL,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      context TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      step_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      input_template TEXT NOT NULL,
      expects TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES runs(id),
      story_index INTEGER NOT NULL,
      story_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      acceptance_criteria TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      output TEXT,
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Add columns to steps table for backwards compat
  const cols = db.prepare("PRAGMA table_info(steps)").all() as Array<{ name: string }>;
  const colNames = new Set(cols.map((c) => c.name));

  if (!colNames.has("type")) {
    db.exec("ALTER TABLE steps ADD COLUMN type TEXT NOT NULL DEFAULT 'single'");
  }
  if (!colNames.has("loop_config")) {
    db.exec("ALTER TABLE steps ADD COLUMN loop_config TEXT");
  }
  if (!colNames.has("current_story_id")) {
    db.exec("ALTER TABLE steps ADD COLUMN current_story_id TEXT");
  }
  if (!colNames.has("abandoned_count")) {
    db.exec("ALTER TABLE steps ADD COLUMN abandoned_count INTEGER DEFAULT 0");
  }

  // Add columns to runs table for backwards compat
  const runCols = db.prepare("PRAGMA table_info(runs)").all() as Array<{ name: string }>;
  const runColNames = new Set(runCols.map((c) => c.name));
  if (!runColNames.has("notify_url")) {
    db.exec("ALTER TABLE runs ADD COLUMN notify_url TEXT");
  }
  if (!runColNames.has("run_number")) {
    db.exec("ALTER TABLE runs ADD COLUMN run_number INTEGER");
  }
  if (!runColNames.has("planning_artifacts")) {
    db.exec("ALTER TABLE runs ADD COLUMN planning_artifacts TEXT");
  }
  ensureRunNumbers(db);
  dedupeStories(db);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_runs_run_number
      ON runs(run_number)
      WHERE run_number IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS uq_stories_run_story
      ON stories(run_id, story_id);

    CREATE INDEX IF NOT EXISTS idx_runs_workflow_status_created
      ON runs(workflow_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_runs_status_updated
      ON runs(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_steps_run_index
      ON steps(run_id, step_index);
    CREATE INDEX IF NOT EXISTS idx_steps_agent_status
      ON steps(agent_id, status);
    CREATE INDEX IF NOT EXISTS idx_steps_run_status
      ON steps(run_id, status);
    CREATE INDEX IF NOT EXISTS idx_stories_run_index
      ON stories(run_id, story_index);
    CREATE INDEX IF NOT EXISTS idx_stories_run_status
      ON stories(run_id, status);
  `);
}

export function getDbPath(): string {
  return DB_PATH;
}
