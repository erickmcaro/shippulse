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

describe("completeStep output schema enforcement", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-output-schema-"));
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

  it("retries on schema violation and completes when schema is satisfied", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = nowIso();

    const outputSchema = JSON.stringify({
      required: ["status", "tests"],
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["done"] },
        tests: { type: "string", minLength: 1 },
      },
    });

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'schema-workflow', 'schema task', 'running', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, output_schema, status, retry_count, max_retries, type, created_at, updated_at) VALUES (?, ?, 'implement', 'schema-workflow_developer', 0, 'do work', 'STATUS: done', ?, 'running', 0, 2, 'single', ?, ?)",
    ).run(stepId, runId, outputSchema, ts, ts);

    const first = stepOpsMod.completeStep(stepId, "STATUS: done");
    assert.deepEqual(first, { advanced: false, runCompleted: false });

    const retriedStep = db.prepare("SELECT status, retry_count FROM steps WHERE id = ?").get(stepId) as {
      status: string;
      retry_count: number;
    };
    assert.equal(retriedStep.status, "pending");
    assert.equal(retriedStep.retry_count, 1);

    db.prepare("UPDATE steps SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(stepId);
    const second = stepOpsMod.completeStep(stepId, "STATUS: done\nTESTS: npm test");
    assert.deepEqual(second, { advanced: false, runCompleted: true });

    const run = db.prepare("SELECT status, context FROM runs WHERE id = ?").get(runId) as { status: string; context: string };
    assert.equal(run.status, "completed");
    const context = JSON.parse(run.context) as Record<string, string>;
    assert.equal(context.status, "done");
    assert.equal(context.tests, "npm test");
  });
});
