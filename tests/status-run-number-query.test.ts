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

describe("status query with #run-number", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-status-run-num-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    dbMod = await import(`../dist/db.js?v=status-run-num-${Date.now()}`);
    statusMod = await import(`../dist/installer/status.js?v=status-run-num-${Date.now()}`);
  });

  beforeEach(() => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
  });

  after(async () => {
    dbMod.closeDb();
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("resolves workflow status by #run-number", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 9, 'feature-dev', 'status lookup', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);

    const result = statusMod.getWorkflowStatus("#9");
    assert.equal(result.status, "ok");
    if (result.status !== "ok") throw new Error("expected status result");
    assert.equal(result.run.id, runId);
    assert.equal(result.run.run_number, 9);
  });

  it("stops a run when queried by #run-number", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 5, 'feature-dev', 'stop lookup', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_builder', 0, '', '', 'running', ?, ?)"
    ).run(stepId, runId, ts, ts);

    const result = await statusMod.stopWorkflow("#5");
    assert.equal(result.status, "ok");

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "cancelled");
  });

  it("resumes a failed run when queried by #run-number", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 6, 'feature-dev', 'resume lookup', 'failed', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_builder', 0, '', '', 'failed', 'oops', ?, ?)"
    ).run(stepId, runId, ts, ts);

    const result = await statusMod.resumeWorkflow("#6");
    assert.equal(result.status, "ok");

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    const step = db.prepare("SELECT status, output FROM steps WHERE id = ?").get(stepId) as { status: string; output: string | null };
    assert.equal(run.status, "running");
    assert.equal(step.status, "pending");
    assert.equal(step.output, null);
  });
});
