import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type StepOpsModule = typeof import("../dist/installer/step-ops.js");

let dbMod: DbModule;
let stepOpsMod: StepOpsModule;
let tmpHome = "";
let originalHome: string | undefined;

describe("STORIES_JSON idempotency", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-stories-idempotency-"));
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

  it("upserts stories without creating duplicates when planner output is replayed", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = new Date().toISOString();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'test-workflow', 'task', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'plan', 'test-workflow_planner', 0, '', '', 'running', ?, ?)"
    ).run(stepId, runId, ts, ts);

    const outputV1 = [
      "STATUS: done",
      "STORIES_JSON: [{\"id\":\"S-1\",\"title\":\"Initial title\",\"description\":\"desc\",\"acceptanceCriteria\":[\"given when then\"]}]",
    ].join("\n");
    stepOpsMod.completeStep(stepId, outputV1);

    const outputV2 = [
      "STATUS: done",
      "STORIES_JSON: [{\"id\":\"S-1\",\"title\":\"Updated title\",\"description\":\"desc\",\"acceptanceCriteria\":[\"given when then\"]}]",
    ].join("\n");
    stepOpsMod.completeStep(stepId, outputV2);

    const count = db.prepare("SELECT COUNT(*) as cnt FROM stories WHERE run_id = ?").get(runId) as { cnt: number };
    assert.equal(count.cnt, 1);
    const story = db.prepare("SELECT story_id, title FROM stories WHERE run_id = ?").get(runId) as { story_id: string; title: string };
    assert.equal(story.story_id, "S-1");
    assert.equal(story.title, "Updated title");
  });
});
