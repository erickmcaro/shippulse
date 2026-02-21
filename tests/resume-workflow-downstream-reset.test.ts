import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type StatusModule = typeof import("../dist/installer/status.js");

let dbMod: DbModule;
let statusMod: StatusModule;
let tmpRoot = "";
let stateDir = "";
let originalStateDir: string | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

describe("resumeWorkflow downstream reset", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-resume-reset-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    dbMod = await import(`../dist/db.js?v=resume-reset-${Date.now()}`);
    statusMod = await import(`../dist/installer/status.js?v=resume-reset-${Date.now()}`);
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

  it("resets downstream failed steps to waiting when resuming a failed run", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const failedStepId = crypto.randomUUID();
    const downstreamFailedStepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'resume test', 'failed', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, abandoned_count, created_at, updated_at) VALUES (?, ?, 'impl', 'wf_dev', 0, '', '', 'failed', 'first failure', 4, ?, ?)"
    ).run(failedStepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, abandoned_count, created_at, updated_at) VALUES (?, ?, 'verify', 'wf_verify', 1, '', '', 'failed', 'downstream failure', 3, ?, ?)"
    ).run(downstreamFailedStepId, runId, ts, ts);

    const result = await statusMod.resumeWorkflow(runId);
    assert.equal(result.status, "ok");

    const reopened = db.prepare("SELECT status, output, abandoned_count FROM steps WHERE id = ?").get(failedStepId) as {
      status: string;
      output: string | null;
      abandoned_count: number;
    };
    assert.equal(reopened.status, "pending");
    assert.equal(reopened.output, null);
    assert.equal(reopened.abandoned_count, 0);

    const downstream = db.prepare("SELECT status, output, abandoned_count FROM steps WHERE id = ?").get(downstreamFailedStepId) as {
      status: string;
      output: string | null;
      abandoned_count: number;
    };
    assert.equal(downstream.status, "waiting");
    assert.equal(downstream.output, null);
    assert.equal(downstream.abandoned_count, 0);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "running");
  });

  it("reopens failed stories when resetting downstream loop steps", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const failedStepId = crypto.randomUUID();
    const downstreamLoopStepId = crypto.randomUUID();
    const failedStoryDbId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'resume loop story reset', 'failed', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, created_at, updated_at) VALUES (?, ?, 'plan', 'wf_plan', 0, '', '', 'failed', 'planner failed', ?, ?)"
    ).run(failedStepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, type, loop_config, created_at, updated_at) VALUES (?, ?, 'implement', 'wf_dev', 1, '', '', 'failed', 'loop failed', 'loop', '{\"over\":\"stories\"}', ?, ?)"
    ).run(downstreamLoopStepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, output, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'failed', 'story failed', 2, 2, ?, ?)"
    ).run(failedStoryDbId, runId, ts, ts);

    const result = await statusMod.resumeWorkflow(runId);
    assert.equal(result.status, "ok");

    const story = db.prepare("SELECT status, output FROM stories WHERE id = ?").get(failedStoryDbId) as {
      status: string;
      output: string | null;
    };
    assert.equal(story.status, "pending");
    assert.equal(story.output, null);
  });

  it("reopens done stories and resets retries when downstream loop is reset", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const failedStepId = crypto.randomUUID();
    const downstreamLoopStepId = crypto.randomUUID();
    const doneStoryDbId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'wf', 'resume loop done story reset', 'failed', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, created_at, updated_at) VALUES (?, ?, 'plan', 'wf_plan', 0, '', '', 'failed', 'planner failed', ?, ?)"
    ).run(failedStepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, type, loop_config, created_at, updated_at) VALUES (?, ?, 'implement', 'wf_dev', 1, '', '', 'done', 'loop done', 'loop', '{\"over\":\"stories\"}', ?, ?)"
    ).run(downstreamLoopStepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, output, retry_count, max_retries, created_at, updated_at) VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'done', 'completed output', 2, 2, ?, ?)"
    ).run(doneStoryDbId, runId, ts, ts);

    const result = await statusMod.resumeWorkflow(runId);
    assert.equal(result.status, "ok");

    const story = db.prepare("SELECT status, output, retry_count FROM stories WHERE id = ?").get(doneStoryDbId) as {
      status: string;
      output: string | null;
      retry_count: number;
    };
    assert.equal(story.status, "pending");
    assert.equal(story.output, null);
    assert.equal(story.retry_count, 0);
  });
});
