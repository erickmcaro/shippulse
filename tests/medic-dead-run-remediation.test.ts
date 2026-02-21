import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type MedicModule = typeof import("../dist/medic/medic.js");

let dbMod: DbModule;
let medicMod: MedicModule;
let tmpHome = "";
let originalHome: string | undefined;

function insertRun(db: ReturnType<DbModule["getDb"]>, runId: string, workflowId: string, status: string) {
  const ts = new Date().toISOString();
  db.prepare(
    "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, ?, 'task', ?, '{}', ?, ?)"
  ).run(runId, workflowId, status, ts, ts);
}

function insertStep(
  db: ReturnType<DbModule["getDb"]>,
  runId: string,
  stepIndex: number,
  status: string,
) {
  const ts = new Date().toISOString();
  db.prepare(
    "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, '', '', ?, ?, ?)"
  ).run(
    crypto.randomUUID(),
    runId,
    `step-${stepIndex}`,
    "wf_agent",
    stepIndex,
    status,
    ts,
    ts,
  );
}

describe("medic dead-run remediation", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-medic-dead-run-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    dbMod = await import("../dist/db.js");
    medicMod = await import("../dist/medic/medic.js");
  });

  beforeEach(() => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
    try {
      db.exec("DELETE FROM medic_checks;");
    } catch {
      // table may not exist before first medic run
    }
  });

  after(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("completes zombie runs when all steps are done and fails those with failed steps", async () => {
    const db = dbMod.getDb();
    const doneOnlyRunId = crypto.randomUUID();
    const failedRunId = crypto.randomUUID();

    insertRun(db, doneOnlyRunId, "project-gap-analysis", "running");
    insertStep(db, doneOnlyRunId, 0, "done");
    insertStep(db, doneOnlyRunId, 1, "done");

    insertRun(db, failedRunId, "feature-dev", "running");
    insertStep(db, failedRunId, 0, "done");
    insertStep(db, failedRunId, 1, "failed");

    const check = await medicMod.runMedicCheck();

    const doneRun = db.prepare("SELECT status FROM runs WHERE id = ?").get(doneOnlyRunId) as { status: string };
    const failedRun = db.prepare("SELECT status FROM runs WHERE id = ?").get(failedRunId) as { status: string };
    assert.equal(doneRun.status, "completed");
    assert.equal(failedRun.status, "failed");

    const doneFinding = check.findings.find((f) => f.runId === doneOnlyRunId);
    const failedFinding = check.findings.find((f) => f.runId === failedRunId);
    assert.equal(doneFinding?.action, "complete_run");
    assert.equal(doneFinding?.remediated, true);
    assert.equal(failedFinding?.action, "fail_run");
    assert.equal(failedFinding?.remediated, true);
  });
});
