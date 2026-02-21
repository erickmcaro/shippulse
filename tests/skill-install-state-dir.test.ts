import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("skill install respects OPENCLAW_STATE_DIR", () => {
  let tmpDir = "";
  let originalHome: string | undefined;
  let originalStateDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-skill-install-"));
    originalHome = process.env.HOME;
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.HOME = path.join(tmpDir, "home");
    process.env.OPENCLAW_STATE_DIR = path.join(tmpDir, "custom-openclaw");
  });

  afterEach(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("installs the bundled workflow skill under the custom state dir", async () => {
    const mod = await import("../dist/installer/skill-install.js");
    const result = await mod.installShipPulseSkill();

    assert.equal(result.installed, true);
    const expectedRoot = path.join(process.env.OPENCLAW_STATE_DIR!, "skills");
    assert.ok(result.path.startsWith(expectedRoot));

    const skillPath = path.join(result.path, "SKILL.md");
    const content = await fs.readFile(skillPath, "utf-8");
    assert.ok(content.includes("ShipPulse"));
  });
});
