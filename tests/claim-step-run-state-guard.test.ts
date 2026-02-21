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

describe("claimStep run-state guard", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-claim-step-state-"));
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

  it("does not claim pending work from completed runs", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = new Date().toISOString();
    const agentId = "feature-dev_developer";

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'completed run', 'completed', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'implement', ?, 0, 'x', 'y', 'pending', ?, ?)",
    ).run(stepId, runId, agentId, ts, ts);

    const claim = stepOpsMod.claimStep(agentId);
    assert.equal(claim.found, false);

    const step = db.prepare("SELECT status FROM steps WHERE id = ?").get(stepId) as { status: string };
    assert.equal(step.status, "pending");
  });
});
