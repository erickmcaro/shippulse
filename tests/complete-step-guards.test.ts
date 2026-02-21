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

function nowIso(): string {
  return new Date().toISOString();
}

describe("completeStep guards", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-complete-step-"));
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

  it("ignores completions for cancelled runs", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'test-workflow', 'cancelled run', 'cancelled', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'build', 'test-workflow_dev', 0, '', '', 'running', ?, ?)",
    ).run(stepId, runId, ts, ts);

    const result = stepOpsMod.completeStep(stepId, "STATUS: done");
    assert.deepEqual(result, { advanced: false, runCompleted: false });

    const step = db.prepare("SELECT status, output FROM steps WHERE id = ?").get(stepId) as { status: string; output: string | null };
    assert.equal(step.status, "running");
    assert.equal(step.output, null);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "cancelled");
  });

  it("allows replay upserts for completed runs without advancing pipeline state", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const downstreamStepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'test-workflow', 'completed run', 'completed', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, created_at, updated_at) VALUES (?, ?, 'build', 'test-workflow_dev', 0, '', '', 'done', 'original output', ?, ?)",
    ).run(stepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'verify', 'test-workflow_verifier', 1, '', '', 'waiting', ?, ?)",
    ).run(downstreamStepId, runId, ts, ts);

    const result = stepOpsMod.completeStep(stepId, "STATUS: done\nCHANGES: replay");
    assert.deepEqual(result, { advanced: false, runCompleted: false });

    const step = db.prepare("SELECT status, output FROM steps WHERE id = ?").get(stepId) as { status: string; output: string | null };
    assert.equal(step.status, "done");
    assert.equal(step.output, "STATUS: done\nCHANGES: replay");

    const downstream = db.prepare("SELECT status FROM steps WHERE id = ?").get(downstreamStepId) as { status: string };
    assert.equal(downstream.status, "waiting");

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "completed");
  });

  it("ignores completions when step is not running", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'test-workflow', 'pending step', 'running', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'verify', 'test-workflow_verifier', 1, '', '', 'pending', ?, ?)",
    ).run(stepId, runId, ts, ts);

    const result = stepOpsMod.completeStep(stepId, "STATUS: done");
    assert.deepEqual(result, { advanced: false, runCompleted: false });

    const step = db.prepare("SELECT status, output FROM steps WHERE id = ?").get(stepId) as { status: string; output: string | null };
    assert.equal(step.status, "pending");
    assert.equal(step.output, null);
  });

  it("ignores duplicate completions for done steps while run is still running", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const doneStepId = crypto.randomUUID();
    const pendingStepId = crypto.randomUUID();
    const waitingStepId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'test-workflow', 'duplicate completion', 'running', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, created_at, updated_at) VALUES (?, ?, 'plan', 'test-workflow_planner', 0, '', '', 'done', 'original output', ?, ?)",
    ).run(doneStepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'build', 'test-workflow_dev', 1, '', '', 'pending', ?, ?)",
    ).run(pendingStepId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'verify', 'test-workflow_verifier', 2, '', '', 'waiting', ?, ?)",
    ).run(waitingStepId, runId, ts, ts);

    const result = stepOpsMod.completeStep(doneStepId, "STATUS: done\nCHANGES: duplicate");
    assert.deepEqual(result, { advanced: false, runCompleted: false });

    const doneStep = db.prepare("SELECT status, output FROM steps WHERE id = ?").get(doneStepId) as { status: string; output: string | null };
    assert.equal(doneStep.status, "done");
    assert.equal(doneStep.output, "original output");

    const pendingStep = db.prepare("SELECT status FROM steps WHERE id = ?").get(pendingStepId) as { status: string };
    assert.equal(pendingStep.status, "pending");

    const waitingStep = db.prepare("SELECT status FROM steps WHERE id = ?").get(waitingStepId) as { status: string };
    assert.equal(waitingStep.status, "waiting");
  });
});
