import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

type EventsModule = typeof import("../dist/installer/events.js");

let eventsMod: EventsModule;
let tmpHome = "";
let originalHome: string | undefined;
let eventsFile = "";

describe("events cache refresh", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-events-cache-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    eventsMod = await import("../dist/installer/events.js");
    eventsFile = path.join(tmpHome, ".openclaw", "shippulse", "events.jsonl");
  });

  beforeEach(async () => {
    await fs.rm(eventsFile, { force: true });
  });

  after(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("refreshes cached reads when the events file changes on disk", async () => {
    const ts = new Date().toISOString();
    eventsMod.emitEvent({ ts, event: "run.started", runId: "run-1", workflowId: "wf" });
    const firstRead = eventsMod.getRecentEvents(10);
    assert.equal(firstRead.length, 1);

    const externalEvt = {
      ts: new Date(Date.now() + 1000).toISOString(),
      event: "run.completed",
      runId: "run-1",
      workflowId: "wf",
    };
    await fs.appendFile(eventsFile, `${JSON.stringify(externalEvt)}\n`, "utf-8");

    const secondRead = eventsMod.getRecentEvents(10);
    assert.equal(secondRead.length, 2);
    assert.equal(secondRead[1].event, "run.completed");
  });
});
