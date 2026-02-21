import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type DaemonCtlModule = typeof import("../dist/server/daemonctl.js");

let daemonCtlMod: DaemonCtlModule;
let stateDir = "";
let originalStateDir: string | undefined;
let originalPath: string | undefined;

describe("daemonctl spawn uses current Node binary", () => {
  before(async () => {
    stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-daemon-execpath-"));
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    originalPath = process.env.PATH;
    daemonCtlMod = await import("../dist/server/daemonctl.js");
  });

  after(async () => {
    try {
      daemonCtlMod.stopDaemon();
    } catch {
      // best-effort cleanup
    }
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    if (originalPath === undefined) delete process.env.PATH;
    else process.env.PATH = originalPath;
    await fs.rm(stateDir, { recursive: true, force: true });
  });

  it("starts even when PATH does not contain node", async () => {
    process.env.PATH = "/definitely-missing-node-bin";
    const port = 62000 + Math.floor(Math.random() * 500);

    const started = await daemonCtlMod.startDaemon(port);
    assert.ok(started.pid > 0);

    const status = daemonCtlMod.getDaemonStatus();
    assert.equal(status?.running, true);

    const stopped = daemonCtlMod.stopDaemon();
    assert.equal(stopped, true);
  });

  it("returns the bound dynamic port when started with port 0", async () => {
    daemonCtlMod.stopDaemon();
    const started = await daemonCtlMod.startDaemon(0);
    assert.ok(started.pid > 0);
    assert.ok(started.port > 0);

    const status = daemonCtlMod.getDaemonStatus();
    assert.equal(status?.running, true);
    assert.equal(status?.port, started.port);

    const stopped = daemonCtlMod.stopDaemon();
    assert.equal(stopped, true);
  });
});
