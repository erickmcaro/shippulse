import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type StatusModule = typeof import("../dist/installer/status.js");

let dbMod: DbModule;
let statusMod: StatusModule;
let tmpHome = "";
let originalHome: string | undefined;

describe("stop workflow story state cleanup", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-stop-story-cancel-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    dbMod = await import("../dist/db.js");
    statusMod = await import("../dist/installer/status.js");
  });

  beforeEach(() => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
  });

  after(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("marks pending/running stories as failed when run is cancelled", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = new Date().toISOString();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'cancel stories', 'running', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_developer', 0, '', '', 'running', ?, ?)",
    ).run(stepId, runId, ts, ts);

    const storyInsert = db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, output, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 2, ?, ?)",
    );
    storyInsert.run(crypto.randomUUID(), runId, 0, "S-1", "Running story", "desc", "[]", "running", null, ts, ts);
    storyInsert.run(crypto.randomUUID(), runId, 1, "S-2", "Pending story", "desc", "[]", "pending", "", ts, ts);
    storyInsert.run(crypto.randomUUID(), runId, 2, "S-3", "Done story", "desc", "[]", "done", "kept", ts, ts);

    const result = await statusMod.stopWorkflow(runId);
    assert.equal(result.status, "ok");

    const rows = db.prepare(
      "SELECT story_id, status, output FROM stories WHERE run_id = ? ORDER BY story_index ASC",
    ).all(runId) as Array<{ story_id: string; status: string; output: string | null }>;

    assert.deepEqual(rows.map((r) => [r.story_id, r.status]), [
      ["S-1", "failed"],
      ["S-2", "failed"],
      ["S-3", "done"],
    ]);
    assert.equal(rows[0].output, "Cancelled by user");
    assert.equal(rows[1].output, "Cancelled by user");
    assert.equal(rows[2].output, "kept");
  });
});
