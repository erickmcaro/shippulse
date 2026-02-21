import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type StatusModule = typeof import("../dist/installer/status.js");
type EventsModule = typeof import("../dist/installer/events.js");

let dbMod: DbModule;
let statusMod: StatusModule;
let eventsMod: EventsModule;
let tmpHome = "";
let originalHome: string | undefined;

describe("stop workflow cancellation event", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-stop-event-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    dbMod = await import("../dist/db.js");
    statusMod = await import("../dist/installer/status.js");
    eventsMod = await import("../dist/installer/events.js");
  });

  beforeEach(async () => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
    const eventsFile = path.join(tmpHome, ".openclaw", "shippulse", "events.jsonl");
    await fs.rm(eventsFile, { force: true });
  });

  after(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("emits run.cancelled instead of run.failed when user stops a run", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const ts = new Date().toISOString();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'idea-to-project', 'cancel me', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'implement', 'idea-to-project_builder', 0, '', '', 'running', ?, ?)"
    ).run(stepId, runId, ts, ts);

    const result = await statusMod.stopWorkflow(runId);
    assert.equal(result.status, "ok");

    const events = eventsMod.getRunEvents(runId, 20);
    assert.ok(events.some((evt) => evt.event === "run.cancelled"));
    assert.ok(!events.some((evt) => evt.event === "run.failed"));
  });
});
