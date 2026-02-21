import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("OPENCLAW_STATE_DIR path resolution", () => {
  let tmpRoot = "";
  let stateDir = "";
  let originalStateDir: string | undefined;
  let originalConfigPath: string | undefined;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-state-dir-"));
    stateDir = path.join(tmpRoot, "custom-state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    originalConfigPath = process.env.OPENCLAW_CONFIG_PATH;
    process.env.OPENCLAW_STATE_DIR = stateDir;
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    if (originalConfigPath === undefined) delete process.env.OPENCLAW_CONFIG_PATH;
    else process.env.OPENCLAW_CONFIG_PATH = originalConfigPath;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("routes runtime files to OPENCLAW_STATE_DIR", async () => {
    const dbMod = await import(`../dist/db.js?v=state-${Date.now()}`);
    const daemonCtlMod = await import(`../dist/server/daemonctl.js?v=state-${Date.now()}`);
    const eventsMod = await import(`../dist/installer/events.js?v=state-${Date.now()}`);

    const expectedRoot = path.join(stateDir, "shippulse");
    assert.equal(dbMod.getDbPath(), path.join(expectedRoot, "shippulse.db"));
    assert.equal(daemonCtlMod.getPidFile(), path.join(expectedRoot, "dashboard.pid"));
    assert.equal(daemonCtlMod.getLogFile(), path.join(expectedRoot, "dashboard.log"));

    eventsMod.emitEvent({
      ts: new Date().toISOString(),
      event: "run.started",
      runId: "state-dir-test",
      workflowId: "feature-dev",
      detail: "state-dir check",
    });
    const eventsFile = path.join(expectedRoot, "events.jsonl");
    const eventsRaw = await fs.readFile(eventsFile, "utf-8");
    assert.match(eventsRaw, /"runId":"state-dir-test"/);
  });

  it("normalizes relative state/config env paths to absolute paths", async () => {
    process.env.OPENCLAW_STATE_DIR = "relative-openclaw-state";
    process.env.OPENCLAW_CONFIG_PATH = "relative-openclaw-state/openclaw.json5";
    try {
      const pathsMod = await import(`../dist/installer/paths.js?v=relative-${Date.now()}`);
      assert.equal(pathsMod.resolveOpenClawStateDir(), path.resolve("relative-openclaw-state"));
      assert.equal(
        pathsMod.resolveOpenClawConfigPath(),
        path.resolve("relative-openclaw-state/openclaw.json5"),
      );
    } finally {
      process.env.OPENCLAW_STATE_DIR = stateDir;
      delete process.env.OPENCLAW_CONFIG_PATH;
    }
  });

  it("expands ~ in state/config env paths", async () => {
    process.env.OPENCLAW_STATE_DIR = "~/tilde-openclaw-state";
    process.env.OPENCLAW_CONFIG_PATH = "~/tilde-openclaw-state/openclaw.json5";
    try {
      const pathsMod = await import(`../dist/installer/paths.js?v=tilde-${Date.now()}`);
      assert.equal(
        pathsMod.resolveOpenClawStateDir(),
        path.join(os.homedir(), "tilde-openclaw-state"),
      );
      assert.equal(
        pathsMod.resolveOpenClawConfigPath(),
        path.join(os.homedir(), "tilde-openclaw-state", "openclaw.json5"),
      );
    } finally {
      process.env.OPENCLAW_STATE_DIR = stateDir;
      delete process.env.OPENCLAW_CONFIG_PATH;
    }
  });
});
