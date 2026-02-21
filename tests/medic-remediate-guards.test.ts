import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type MedicModule = typeof import("../dist/medic/medic.js");

let dbMod: DbModule;
let medicMod: MedicModule;
let tmpRoot = "";
let stateDir = "";
let originalStateDir: string | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

describe("medic reset_step remediation guards", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-medic-remediate-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    dbMod = await import(`../dist/db.js?v=medic-remediate-${Date.now()}`);
    medicMod = await import(`../dist/medic/medic.js?v=medic-remediate-${Date.now()}`);
  });

  beforeEach(() => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    dbMod.closeDb();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("does not remediate when the run is no longer running", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'cancelled', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, abandoned_count, created_at, updated_at) VALUES (?, ?, 'impl', 'wf_dev', 0, '', '', 'running', 0, ?, ?)"
    ).run(stepId, runId, ts, ts);

    const result = await medicMod.remediateFinding({
      check: "stuck_steps",
      severity: "warning",
      message: "stuck",
      action: "reset_step",
      runId,
      stepId,
      remediated: false,
    });
    assert.equal(result, false);

    const step = db.prepare("SELECT status, abandoned_count FROM steps WHERE id = ?").get(stepId) as { status: string; abandoned_count: number };
    assert.equal(step.status, "running");
    assert.equal(step.abandoned_count, 0);
  });

  it("does not remediate when the step is no longer running", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, abandoned_count, created_at, updated_at) VALUES (?, ?, 'impl', 'wf_dev', 0, '', '', 'pending', 0, ?, ?)"
    ).run(stepId, runId, ts, ts);

    const result = await medicMod.remediateFinding({
      check: "stuck_steps",
      severity: "warning",
      message: "stuck",
      action: "reset_step",
      runId,
      stepId,
      remediated: false,
    });
    assert.equal(result, false);

    const step = db.prepare("SELECT status, abandoned_count FROM steps WHERE id = ?").get(stepId) as { status: string; abandoned_count: number };
    assert.equal(step.status, "pending");
    assert.equal(step.abandoned_count, 0);
  });

  it("resets running stuck steps when run is active", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const storyDbId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'task', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, output, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'running', 'stale story output', 0, 2, ?, ?)"
    ).run(storyDbId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, current_story_id, abandoned_count, created_at, updated_at) VALUES (?, ?, 'impl', 'wf_dev', 0, '', '', 'running', 'stale step output', ?, 0, ?, ?)"
    ).run(stepId, runId, storyDbId, ts, ts);

    const result = await medicMod.remediateFinding({
      check: "stuck_steps",
      severity: "warning",
      message: "stuck",
      action: "reset_step",
      runId,
      stepId,
      remediated: false,
    });
    assert.equal(result, true);

    const step = db.prepare("SELECT status, output, abandoned_count, current_story_id FROM steps WHERE id = ?").get(stepId) as {
      status: string;
      output: string | null;
      abandoned_count: number;
      current_story_id: string | null;
    };
    assert.equal(step.status, "pending");
    assert.equal(step.output, null);
    assert.equal(step.abandoned_count, 1);
    assert.equal(step.current_story_id, null);

    const story = db.prepare("SELECT status, output FROM stories WHERE id = ?").get(storyDbId) as {
      status: string;
      output: string | null;
    };
    assert.equal(story.status, "pending");
    assert.equal(story.output, null);
  });
});
