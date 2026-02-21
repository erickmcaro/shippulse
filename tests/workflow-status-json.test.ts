import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

type StatusModule = typeof import("../dist/installer/status.js");
type DbModule = typeof import("../dist/db.js");

let statusMod: StatusModule;
let dbMod: DbModule;
let tmpHome = "";
let originalHome: string | undefined;

function now() {
  return new Date().toISOString();
}

describe("workflow status json", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-status-json-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;

    dbMod = await import("../dist/db.js");
    statusMod = await import("../dist/installer/status.js");
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

  it("returns structured json for a found run", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const t = now();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 42, 'feature-dev', 'add status json', 'running', '{}', ?, ?)"
    ).run(runId, t, t);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'plan', 'feature-dev_planner', 0, '', '', 'done', ?, ?)"
    ).run(crypto.randomUUID(), runId, t, t);

    const payload = statusMod.getWorkflowStatusJson("add status json", () => [
      { storyId: "S-1", status: "done", title: "Story one" },
      { storyId: "S-2", status: "running", title: "Story two" },
    ]);

    assert.equal(payload.status, "running");
    assert.equal(payload.workflow, "feature-dev");
    assert.equal(payload.runNumber, 42);
    assert.ok(Array.isArray(payload.steps));
    assert.deepEqual(payload.storySummary, { total: 2, done: 1, running: 1, failed: 0 });
  });

  it("returns not_found json payload when no run matches", () => {
    const payload = statusMod.getWorkflowStatusJson("missing-run");
    assert.equal(payload.status, "not_found");
    assert.ok(typeof payload.message === "string");
  });
});

