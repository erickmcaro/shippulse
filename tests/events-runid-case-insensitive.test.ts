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

describe("events run-id matching is case-insensitive", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-events-case-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    eventsMod = await import(`../dist/installer/events.js?v=events-case-${Date.now()}`);
  });

  beforeEach(async () => {
    await fs.rm(path.join(stateDir, "shippulse", "events.jsonl"), { force: true });
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("returns events for uppercase run-id prefixes", () => {
    const runId = "abcdabcd-abcd-4abc-8abc-abcdefabcdef";
    const ts = new Date().toISOString();
    eventsMod.emitEvent({
      ts,
      event: "run.started",
      runId,
      workflowId: "feature-dev",
      detail: "started",
    });

    const events = eventsMod.getRunEvents("ABCDAB", 10);
    assert.equal(events.length, 1);
    assert.equal(events[0].runId, runId);
  });
});
