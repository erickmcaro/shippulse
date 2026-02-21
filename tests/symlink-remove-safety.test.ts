import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("removeCliSymlink safety", () => {
  let tmpDir = "";
  let originalHome: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-symlink-remove-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
    await fs.mkdir(path.join(tmpDir, ".local", "bin"), { recursive: true });
  });

  afterEach(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("does not remove user-managed non-symlink files", async () => {
    const mod = await import(`../dist/installer/symlink.js?v=non-symlink-${Date.now()}`);
    const binPath = path.join(tmpDir, ".local", "bin", "shippulse");
    await fs.writeFile(binPath, "#!/bin/sh\necho user script\n", "utf-8");

    mod.removeCliSymlink();

    const contents = await fs.readFile(binPath, "utf-8");
    assert.ok(contents.includes("user script"));
  });

  it("removes symlinked shippulse entry", async () => {
    const mod = await import(`../dist/installer/symlink.js?v=symlink-${Date.now()}`);
    const binPath = path.join(tmpDir, ".local", "bin", "shippulse");
    const target = path.join(tmpDir, "target-cli.js");
    await fs.writeFile(target, "console.log('cli')\n", "utf-8");
    await fs.symlink(target, binPath);

    mod.removeCliSymlink();

    const exists = await fs.access(binPath).then(() => true).catch(() => false);
    assert.equal(exists, false);
  });
});
