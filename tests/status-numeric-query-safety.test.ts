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

describe("numeric run-number query safety", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-status-numeric-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    dbMod = await import(`../dist/db.js?v=status-numeric-${Date.now()}`);
    statusMod = await import(`../dist/installer/status.js?v=status-numeric-${Date.now()}`);
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

  it("does not resolve numeric status queries by run-id prefix when run number is missing", () => {
    const db = dbMod.getDb();
    const runId = "12aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const ts = nowIso();
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 99, 'feature-dev', 'prefix run', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);

    const result = statusMod.getWorkflowStatus("12");
    assert.equal(result.status, "not_found");
  });

  it("does not stop a run by numeric id-prefix fallback when run number is missing", async () => {
    const db = dbMod.getDb();
    const runId = "12bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const stepId = crypto.randomUUID();
    const ts = nowIso();
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 88, 'feature-dev', 'prefix stop', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_builder', 0, '', '', 'running', ?, ?)"
    ).run(stepId, runId, ts, ts);

    const result = await statusMod.stopWorkflow("12");
    assert.equal(result.status, "not_found");

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "running");
  });
});
