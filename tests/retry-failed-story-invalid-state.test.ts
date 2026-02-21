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
let tmpHome = "";
let originalHome: string | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

describe("retryFailedStory invalid-state guard", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-retry-story-state-"));
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

  it("does not resume a run when failed stories exist but no loop step exists", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const storyDbId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'failed story/no loop', 'failed', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      `INSERT INTO stories
       (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at)
       VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'failed', 1, 2, ?, ?)`
    ).run(storyDbId, runId, ts, ts);

    const result = await statusMod.retryFailedStory(runId);
    assert.equal(result.status, "invalid_state");

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    const story = db.prepare("SELECT status, retry_count FROM stories WHERE id = ?").get(storyDbId) as { status: string; retry_count: number };
    assert.equal(run.status, "failed");
    assert.equal(story.status, "failed");
    assert.equal(story.retry_count, 1);
  });

  it("clears stale outputs when resetting failed story/loop/verify state", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const storyDbId = crypto.randomUUID();
    const loopStepId = crypto.randomUUID();
    const verifyStepId = crypto.randomUUID();
    const ts = nowIso();
    const loopConfig = JSON.stringify({ over: "stories", verifyEach: true, verifyStep: "verify" });

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'retry story output reset', 'failed', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      `INSERT INTO stories
       (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, output, retry_count, max_retries, created_at, updated_at)
       VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'failed', 'story failed output', 1, 2, ?, ?)`
    ).run(storyDbId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, retry_count, max_retries, abandoned_count, type, loop_config, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_developer', 1, '', '', 'failed', 'loop failed output', 1, 2, 4, 'loop', ?, ?, ?)"
    ).run(loopStepId, runId, loopConfig, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, retry_count, max_retries, abandoned_count, type, created_at, updated_at) VALUES (?, ?, 'verify', 'feature-dev_verifier', 2, '', '', 'failed', 'verify failed output', 1, 2, 3, 'single', ?, ?)"
    ).run(verifyStepId, runId, ts, ts);

    const result = await statusMod.retryFailedStory(runId);
    assert.equal(result.status, "ok");

    const story = db.prepare("SELECT status, output, retry_count FROM stories WHERE id = ?").get(storyDbId) as {
      status: string;
      output: string | null;
      retry_count: number;
    };
    assert.equal(story.status, "pending");
    assert.equal(story.output, null);
    assert.equal(story.retry_count, 0);

    const loopStep = db.prepare("SELECT status, output, retry_count, abandoned_count, current_story_id FROM steps WHERE id = ?").get(loopStepId) as {
      status: string;
      output: string | null;
      retry_count: number;
      abandoned_count: number;
      current_story_id: string | null;
    };
    assert.equal(loopStep.status, "pending");
    assert.equal(loopStep.output, null);
    assert.equal(loopStep.retry_count, 0);
    assert.equal(loopStep.abandoned_count, 0);
    assert.equal(loopStep.current_story_id, null);

    const verifyStep = db.prepare("SELECT status, output, retry_count, abandoned_count FROM steps WHERE id = ?").get(verifyStepId) as {
      status: string;
      output: string | null;
      retry_count: number;
      abandoned_count: number;
    };
    assert.equal(verifyStep.status, "waiting");
    assert.equal(verifyStep.output, null);
    assert.equal(verifyStep.retry_count, 0);
    assert.equal(verifyStep.abandoned_count, 0);
  });

  it("returns invalid_state when non-loop failed steps still exist", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const storyDbId = crypto.randomUUID();
    const loopStepId = crypto.randomUUID();
    const otherFailedStepId = crypto.randomUUID();
    const ts = nowIso();
    const loopConfig = JSON.stringify({ over: "stories", verifyEach: true, verifyStep: "verify" });

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'retry blocked by other failed step', 'failed', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      `INSERT INTO stories
       (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, retry_count, max_retries, created_at, updated_at)
       VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[]', 'failed', 1, 2, ?, ?)`
    ).run(storyDbId, runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count, max_retries, type, loop_config, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_developer', 1, '', '', 'failed', 1, 2, 'loop', ?, ?, ?)"
    ).run(loopStepId, runId, loopConfig, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, output, retry_count, max_retries, type, created_at, updated_at) VALUES (?, ?, 'release', 'feature-dev_release', 3, '', '', 'failed', 'release failed', 1, 2, 'single', ?, ?)"
    ).run(otherFailedStepId, runId, ts, ts);

    const result = await statusMod.retryFailedStory(runId);
    assert.equal(result.status, "invalid_state");
    assert.match(result.message, /failed step "release"/);

    const story = db.prepare("SELECT status, retry_count FROM stories WHERE id = ?").get(storyDbId) as { status: string; retry_count: number };
    assert.equal(story.status, "failed");
    assert.equal(story.retry_count, 1);

    const run = db.prepare("SELECT status FROM runs WHERE id = ?").get(runId) as { status: string };
    assert.equal(run.status, "failed");
  });
});
