import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type EventsModule = typeof import("../dist/installer/events.js");

let eventsMod: EventsModule;
let tmpRoot = "";
let stateDir = "";
let originalStateDir: string | undefined;

describe("events limit normalization", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-events-limit-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    eventsMod = await import(`../dist/installer/events.js?v=events-limit-${Date.now()}`);
  });

  beforeEach(async () => {
    const eventsPath = path.join(stateDir, "shippulse", "events.jsonl");
    await fs.rm(eventsPath, { force: true });
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("does not treat negative limits as slice offsets", () => {
    const runId = "run-limit-test";
    const tsBase = Date.now();

    eventsMod.emitEvent({
      ts: new Date(tsBase).toISOString(),
      event: "run.started",
      runId,
      workflowId: "wf",
      detail: "first",
    });
    eventsMod.emitEvent({
      ts: new Date(tsBase + 1).toISOString(),
      event: "step.running",
      runId,
      workflowId: "wf",
      detail: "second",
    });
    eventsMod.emitEvent({
      ts: new Date(tsBase + 2).toISOString(),
      event: "step.done",
      runId,
      workflowId: "wf",
      detail: "third",
    });

    const runEvents = eventsMod.getRunEvents(runId, -1);
    assert.equal(runEvents.length, 3);
    assert.equal(runEvents[0].detail, "first");

    const recentEvents = eventsMod.getRecentEvents(-1);
    assert.equal(recentEvents.length, 3);
    assert.equal(recentEvents[0].detail, "first");
  });
});
