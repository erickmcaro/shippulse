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

describe("missing STORIES_JSON guardrails", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-home-"));
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

  it("retries upstream step when a future loop exists but no stories were produced", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const planStepId = crypto.randomUUID();
    const loopStepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, max_retries, created_at, updated_at, type) VALUES (?, ?, 'plan', 'feature-dev_planner', 0, '', 'STATUS: done', 'running', 2, ?, ?, 'single')"
    ).run(planStepId, runId, t, t);

    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at, type, loop_config) VALUES (?, ?, 'implement', 'feature-dev_developer', 1, '', 'STATUS: done', 'waiting', ?, ?, 'loop', ?)"
    ).run(loopStepId, runId, t, t, JSON.stringify({ over: "stories", completion: "all_done" }));

    const result = stepOps.completeStep(planStepId, "STATUS: done\nCHANGES: planned");
    assert.deepEqual(result, { advanced: false, runCompleted: false });

    const plan = db.prepare("SELECT status, retry_count FROM steps WHERE id = ?").get(planStepId) as { status: string; retry_count: number };
    assert.equal(plan.status, "pending", "planner step should be retried");
    assert.equal(plan.retry_count, 1, "retry count should increment");

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "running", "run should stay active for retry");
  });

  it("fails loop claim when there are zero stories", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const loopStepId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'task', 'running', '{}', ?, ?)"
    ).run(runId, t, t);

    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at, type, loop_config) VALUES (?, ?, 'implement', 'feature-dev_developer', 1, '', 'STATUS: done', 'pending', ?, ?, 'loop', ?)"
    ).run(loopStepId, runId, t, t, JSON.stringify({ over: "stories", completion: "all_done" }));

    const result = stepOps.claimStep("feature-dev_developer");
    assert.equal(result.found, false, "no work should be returned");

    const step = db.prepare("SELECT status FROM steps WHERE id = ?").get(loopStepId) as { status: string };
    assert.equal(step.status, "failed", "loop step should fail fast on missing stories");

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "failed", "run should fail to prevent false success");
  });
});

