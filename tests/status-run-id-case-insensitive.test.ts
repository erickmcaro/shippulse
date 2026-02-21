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

describe("run-id lookup is case-insensitive", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-status-case-id-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    dbMod = await import(`../dist/db.js?v=status-case-id-${Date.now()}`);
    statusMod = await import(`../dist/installer/status.js?v=status-case-id-${Date.now()}`);
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

  it("matches workflow status by uppercase run-id prefix", () => {
    const db = dbMod.getDb();
    const runId = "abcdabcd-abcd-4abc-8abc-abcdefabcdef";
    const ts = nowIso();
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 21, 'feature-dev', 'case status', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);

    const result = statusMod.getWorkflowStatus("ABCDAB");
    assert.equal(result.status, "ok");
    if (result.status !== "ok") throw new Error("expected status result");
    assert.equal(result.run.id, runId);
  });

  it("matches stop query by uppercase full run id", async () => {
    const db = dbMod.getDb();
    const runId = "deadbeef-dead-4bee-8bee-deadbeefcafe";
    const stepId = crypto.randomUUID();
    const ts = nowIso();
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 22, 'feature-dev', 'case stop', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_builder', 0, '', '', 'running', ?, ?)"
    ).run(stepId, runId, ts, ts);

    const result = await statusMod.stopWorkflow(runId.toUpperCase());
    assert.equal(result.status, "ok");
    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "cancelled");
  });
});
