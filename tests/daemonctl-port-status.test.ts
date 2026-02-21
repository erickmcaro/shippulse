import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("daemonctl port metadata", () => {
  let tmpRoot = "";
  let stateDir = "";
  let originalStateDir: string | undefined;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-daemonctl-port-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("reports port from dashboard.port when pid is live", async () => {
    const mod = await import(`../dist/server/daemonctl.js?v=port-${Date.now()}`);
    const root = path.join(stateDir, "shippulse");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "dashboard.pid"), String(process.pid), "utf-8");
    await fs.writeFile(path.join(root, "dashboard.port"), "61234", "utf-8");

    const status = mod.getDaemonStatus();
    assert.equal(status?.running, true);
    assert.equal(status?.port, 61234);
  });

  it("removes stale pid + port metadata when pid is dead", async () => {
    const mod = await import(`../dist/server/daemonctl.js?v=stale-${Date.now()}`);
    const root = path.join(stateDir, "shippulse");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "dashboard.pid"), "999999", "utf-8");
    await fs.writeFile(path.join(root, "dashboard.port"), "61234", "utf-8");

    const running = mod.isRunning();
    assert.equal(running.running, false);

    const pidExists = await fs.access(path.join(root, "dashboard.pid")).then(() => true).catch(() => false);
    const portExists = await fs.access(path.join(root, "dashboard.port")).then(() => true).catch(() => false);
    assert.equal(pidExists, false);
    assert.equal(portExists, false);
  });

  it("removes stale pid + port metadata when pid file is invalid", async () => {
    const mod = await import(`../dist/server/daemonctl.js?v=invalid-${Date.now()}`);
    const root = path.join(stateDir, "shippulse");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "dashboard.pid"), "not-a-number", "utf-8");
    await fs.writeFile(path.join(root, "dashboard.port"), "61234", "utf-8");

    const running = mod.isRunning();
    assert.equal(running.running, false);

    const pidExists = await fs.access(path.join(root, "dashboard.pid")).then(() => true).catch(() => false);
    const portExists = await fs.access(path.join(root, "dashboard.port")).then(() => true).catch(() => false);
    assert.equal(pidExists, false);
    assert.equal(portExists, false);
  });

  it("treats partially numeric pid values as invalid metadata", async () => {
    const mod = await import(`../dist/server/daemonctl.js?v=partial-pid-${Date.now()}`);
    const root = path.join(stateDir, "shippulse");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "dashboard.pid"), `${process.pid}garbage`, "utf-8");
    await fs.writeFile(path.join(root, "dashboard.port"), "61234", "utf-8");

    const running = mod.isRunning();
    assert.equal(running.running, false);

    const pidExists = await fs.access(path.join(root, "dashboard.pid")).then(() => true).catch(() => false);
    const portExists = await fs.access(path.join(root, "dashboard.port")).then(() => true).catch(() => false);
    assert.equal(pidExists, false);
    assert.equal(portExists, false);
  });

  it("treats pid 0 as invalid metadata", async () => {
    const mod = await import(`../dist/server/daemonctl.js?v=zero-pid-${Date.now()}`);
    const root = path.join(stateDir, "shippulse");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "dashboard.pid"), "0", "utf-8");
    await fs.writeFile(path.join(root, "dashboard.port"), "61234", "utf-8");

    const running = mod.isRunning();
    assert.equal(running.running, false);

    const pidExists = await fs.access(path.join(root, "dashboard.pid")).then(() => true).catch(() => false);
    const portExists = await fs.access(path.join(root, "dashboard.port")).then(() => true).catch(() => false);
    assert.equal(pidExists, false);
    assert.equal(portExists, false);
  });

  it("ignores and removes invalid partially numeric port metadata", async () => {
    const mod = await import(`../dist/server/daemonctl.js?v=partial-port-${Date.now()}`);
    const root = path.join(stateDir, "shippulse");
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, "dashboard.pid"), String(process.pid), "utf-8");
    await fs.writeFile(path.join(root, "dashboard.port"), "61234xyz", "utf-8");

    const status = mod.getDaemonStatus();
    assert.equal(status?.running, true);
    assert.equal(status?.port, undefined);

    const portExists = await fs.access(path.join(root, "dashboard.port")).then(() => true).catch(() => false);
    assert.equal(portExists, false);
  });

  it("removes stale port metadata when pid file is missing", async () => {
    const mod = await import(`../dist/server/daemonctl.js?v=missing-pid-${Date.now()}`);
    const root = path.join(stateDir, "shippulse");
    await fs.mkdir(root, { recursive: true });
    await fs.rm(path.join(root, "dashboard.pid"), { force: true });
    await fs.writeFile(path.join(root, "dashboard.port"), "61234", "utf-8");

    const running = mod.isRunning();
    assert.equal(running.running, false);

    const portExists = await fs.access(path.join(root, "dashboard.port")).then(() => true).catch(() => false);
    assert.equal(portExists, false);
  });
});
