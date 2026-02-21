import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

type StepOpsModule = typeof import("../dist/installer/step-ops.js");
type DbModule = typeof import("../dist/db.js");

let stepOps: StepOpsModule;
let dbMod: DbModule;
let tmpHome = "";
let originalHome: string | undefined;

function now(): string {
  return new Date().toISOString();
}

describe("step integrity guards", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-integrity-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;

    dbMod = await import("../dist/db.js");
    stepOps = await import("../dist/installer/step-ops.js");
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

  it("rejects unresolved placeholders during claim and retries the step", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'project-gap-analysis', 'task', 'running', '{}', ?, ?)",
    ).run(runId, t, t);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count, max_retries, type, created_at, updated_at) VALUES (?, ?, 'generate-missing-features', 'project-gap-analysis_feature-gap-designer', 2, 'Need {{missing_epics_json}} now', 'STATUS: done', 'pending', 0, 2, 'single', ?, ?)",
    ).run(stepId, runId, t, t);

    const claim = stepOps.claimStep("project-gap-analysis_feature-gap-designer");
    assert.equal(claim.found, false, "claim should be blocked on unresolved placeholders");

    const row = db.prepare("SELECT status, retry_count FROM steps WHERE id = ?").get(stepId) as { status: string; retry_count: number };
    assert.equal(row.status, "pending", "step should return to pending for retry");
    assert.equal(row.retry_count, 1, "retry count should increment");
  });

  it("blocks out-of-order claim when prior step is not done", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const priorStepId = crypto.randomUUID();
    const currentStepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'task', 'running', '{}', ?, ?)",
    ).run(runId, t, t);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, created_at, updated_at) VALUES (?, ?, 'plan', 'feature-dev_planner', 0, 'Plan', 'STATUS: done', 'waiting', 'single', ?, ?)",
    ).run(priorStepId, runId, t, t);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_developer', 1, 'Implement', 'STATUS: done', 'pending', 'single', ?, ?)",
    ).run(currentStepId, runId, t, t);

    const claim = stepOps.claimStep("feature-dev_developer");
    assert.equal(claim.found, false, "monotonic guard should block claim");

    const step = db.prepare("SELECT status FROM steps WHERE id = ?").get(currentStepId) as { status: string };
    assert.equal(step.status, "pending", "pending step remains unclaimed");
  });

  it("prevents retry reopening when downstream already progressed", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const upstreamStepId = crypto.randomUUID();
    const downstreamStepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'task', 'running', '{}', ?, ?)",
    ).run(runId, t, t);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count, max_retries, type, created_at, updated_at) VALUES (?, ?, 'plan', 'feature-dev_planner', 0, 'Plan', 'STATUS: done', 'running', 0, 2, 'single', ?, ?)",
    ).run(upstreamStepId, runId, t, t);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count, max_retries, type, created_at, updated_at) VALUES (?, ?, 'verify', 'feature-dev_verifier', 1, 'Verify', 'STATUS: done', 'done', 0, 2, 'single', ?, ?)",
    ).run(downstreamStepId, runId, t, t);

    const result = stepOps.failStep(upstreamStepId, "synthetic failure");
    assert.deepEqual(result, { retrying: false, runFailed: true });

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "failed", "run should fail when out-of-order retry is blocked");

    const upstream = db.prepare("SELECT status FROM steps WHERE id = ?").get(upstreamStepId) as { status: string };
    assert.equal(upstream.status, "failed", "upstream step should be terminal after integrity block");
  });

  it("ignores failStep calls on non-running steps", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'task', 'running', '{}', ?, ?)",
    ).run(runId, t, t);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count, max_retries, type, created_at, updated_at) VALUES (?, ?, 'plan', 'feature-dev_planner', 0, 'Plan', 'STATUS: done', 'done', 0, 2, 'single', ?, ?)",
    ).run(stepId, runId, t, t);

    const result = stepOps.failStep(stepId, "late failure");
    assert.deepEqual(result, { retrying: false, runFailed: false });

    const step = db.prepare("SELECT status FROM steps WHERE id = ?").get(stepId) as { status: string };
    assert.equal(step.status, "done");
  });
});

