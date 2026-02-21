import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type StepOpsModule = typeof import("../dist/installer/step-ops.js");

let dbMod: DbModule;
let stepOpsMod: StepOpsModule;
let tmpHome = "";
let originalHome: string | undefined;

function oldIso(): string {
  return "2000-01-01T00:00:00.000Z";
}

describe("cleanupAbandonedSteps terminal-run guard", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-cleanup-terminal-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    dbMod = await import("../dist/db.js");
    stepOpsMod = await import("../dist/installer/step-ops.js");
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

  it("does not reset abandoned running steps for failed runs", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const old = oldIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'failed run', 'failed', '{}', ?, ?)"
    ).run(runId, old, old);
    db.prepare(
      `INSERT INTO steps
       (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, retry_count, max_retries, abandoned_count, created_at, updated_at)
       VALUES (?, ?, 'implement', 'feature-dev_developer', 0, '', '', 'running', 'single', 0, 3, 0, ?, ?)`
    ).run(stepId, runId, old, old);

    stepOpsMod.cleanupAbandonedSteps();

    const step = db.prepare("SELECT status, abandoned_count FROM steps WHERE id = ?").get(stepId) as { status: string; abandoned_count: number };
    assert.equal(step.status, "running");
    assert.equal(step.abandoned_count, 0);
  });

  it("does not reset abandoned running stories for cancelled runs", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const storyDbId = crypto.randomUUID();
    const old = oldIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'cancelled run', 'cancelled', '{}', ?, ?)"
    ).run(runId, old, old);
    db.prepare(
      `INSERT INTO stories
       (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at)
       VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'running', 0, 2, ?, ?)`
    ).run(storyDbId, runId, old, old);

    stepOpsMod.cleanupAbandonedSteps();

    const story = db.prepare("SELECT status, retry_count FROM stories WHERE id = ?").get(storyDbId) as { status: string; retry_count: number };
    assert.equal(story.status, "running");
    assert.equal(story.retry_count, 0);
  });
});
