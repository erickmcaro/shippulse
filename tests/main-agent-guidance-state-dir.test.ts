import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

describe("main-agent guidance path resolution", () => {
  let tmpDir = "";
  let originalHome: string | undefined;
  let originalStateDir: string | undefined;
  let originalConfigPath: string | undefined;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-main-guidance-"));
    originalHome = process.env.HOME;
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    originalConfigPath = process.env.OPENCLAW_CONFIG_PATH;

    process.env.HOME = path.join(tmpDir, "home");
    process.env.OPENCLAW_STATE_DIR = path.join(tmpDir, "custom-openclaw");
    delete process.env.OPENCLAW_CONFIG_PATH;

    await fs.mkdir(process.env.OPENCLAW_STATE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(process.env.OPENCLAW_STATE_DIR, "openclaw.json"),
      "{}\n",
      "utf-8",
    );
  });

  afterEach(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    if (originalConfigPath === undefined) delete process.env.OPENCLAW_CONFIG_PATH;
    else process.env.OPENCLAW_CONFIG_PATH = originalConfigPath;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("writes guidance files under OPENCLAW_STATE_DIR/workspace by default", async () => {
    const guidanceMod = await import("../dist/installer/main-agent-guidance.js");
    const pathsMod = await import("../dist/installer/paths.js");

    await guidanceMod.updateMainAgentGuidance();

    const workspaceDir = path.join(process.env.OPENCLAW_STATE_DIR!, "workspace");
    const toolsPath = path.join(workspaceDir, "TOOLS.md");
    const agentsPath = path.join(workspaceDir, "AGENTS.md");

    const tools = await fs.readFile(toolsPath, "utf-8");
    const agents = await fs.readFile(agentsPath, "utf-8");
    const expectedCli = `node "${pathsMod.resolveShipPulseCli()}"`;

    assert.ok(tools.includes(expectedCli));
    assert.ok(agents.includes(expectedCli));
    assert.ok(tools.includes("<!-- shippulse:workflows -->"));
    assert.ok(agents.includes("<!-- shippulse:workflows -->"));
  });

  it("deduplicates legacy repeated workflow guidance blocks", async () => {
    const guidanceMod = await import("../dist/installer/main-agent-guidance.js");
    const workspaceDir = path.join(process.env.OPENCLAW_STATE_DIR!, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });

    const duplicateBlocks = [
      "header",
      "<!-- shippulse:workflows -->",
      "legacy 1",
      "<!-- /shippulse:workflows -->",
      "middle",
      "<!-- shippulse:workflows -->",
      "legacy 2",
      "<!-- /shippulse:workflows -->",
      "footer",
      "",
    ].join("\n");
    await fs.writeFile(path.join(workspaceDir, "TOOLS.md"), duplicateBlocks, "utf-8");
    await fs.writeFile(path.join(workspaceDir, "AGENTS.md"), duplicateBlocks, "utf-8");

    await guidanceMod.updateMainAgentGuidance();

    const toolsAfterUpdate = await fs.readFile(path.join(workspaceDir, "TOOLS.md"), "utf-8");
    const agentsAfterUpdate = await fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf-8");
    assert.equal((toolsAfterUpdate.match(/<!-- shippulse:workflows -->/g) ?? []).length, 1);
    assert.equal((agentsAfterUpdate.match(/<!-- shippulse:workflows -->/g) ?? []).length, 1);

    await guidanceMod.removeMainAgentGuidance();
    const toolsAfterRemove = await fs.readFile(path.join(workspaceDir, "TOOLS.md"), "utf-8");
    const agentsAfterRemove = await fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf-8");
    assert.equal((toolsAfterRemove.match(/<!-- shippulse:workflows -->/g) ?? []).length, 0);
    assert.equal((agentsAfterRemove.match(/<!-- shippulse:workflows -->/g) ?? []).length, 0);
    assert.ok(toolsAfterRemove.includes("header"));
    assert.ok(toolsAfterRemove.includes("footer"));
  });

  it("replaces dangling legacy block missing closing marker", async () => {
    const guidanceMod = await import("../dist/installer/main-agent-guidance.js");
    const workspaceDir = path.join(process.env.OPENCLAW_STATE_DIR!, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });

    const danglingBlock = [
      "header",
      "<!-- shippulse:workflows -->",
      "legacy dangling block",
      "",
    ].join("\n");
    await fs.writeFile(path.join(workspaceDir, "TOOLS.md"), danglingBlock, "utf-8");
    await fs.writeFile(path.join(workspaceDir, "AGENTS.md"), danglingBlock, "utf-8");

    await guidanceMod.updateMainAgentGuidance();

    const toolsAfterUpdate = await fs.readFile(path.join(workspaceDir, "TOOLS.md"), "utf-8");
    const agentsAfterUpdate = await fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf-8");
    assert.equal((toolsAfterUpdate.match(/<!-- shippulse:workflows -->/g) ?? []).length, 1);
    assert.equal((agentsAfterUpdate.match(/<!-- shippulse:workflows -->/g) ?? []).length, 1);
    assert.ok(toolsAfterUpdate.includes("header"));
    assert.ok(!toolsAfterUpdate.includes("legacy dangling block"));
    assert.ok(!agentsAfterUpdate.includes("legacy dangling block"));
  });

  it("removes orphaned closing marker before inserting fresh block", async () => {
    const guidanceMod = await import("../dist/installer/main-agent-guidance.js");
    const workspaceDir = path.join(process.env.OPENCLAW_STATE_DIR!, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });

    const orphanedEndOnly = [
      "header",
      "<!-- /shippulse:workflows -->",
      "footer",
      "",
    ].join("\n");
    await fs.writeFile(path.join(workspaceDir, "TOOLS.md"), orphanedEndOnly, "utf-8");
    await fs.writeFile(path.join(workspaceDir, "AGENTS.md"), orphanedEndOnly, "utf-8");

    await guidanceMod.updateMainAgentGuidance();

    const toolsAfterUpdate = await fs.readFile(path.join(workspaceDir, "TOOLS.md"), "utf-8");
    const agentsAfterUpdate = await fs.readFile(path.join(workspaceDir, "AGENTS.md"), "utf-8");
    assert.equal((toolsAfterUpdate.match(/<!-- shippulse:workflows -->/g) ?? []).length, 1);
    assert.equal((toolsAfterUpdate.match(/<!-- \/shippulse:workflows -->/g) ?? []).length, 1);
    assert.equal((agentsAfterUpdate.match(/<!-- shippulse:workflows -->/g) ?? []).length, 1);
    assert.equal((agentsAfterUpdate.match(/<!-- \/shippulse:workflows -->/g) ?? []).length, 1);
    assert.ok(toolsAfterUpdate.includes("header"));
    assert.ok(toolsAfterUpdate.includes("footer"));
    assert.ok(agentsAfterUpdate.includes("header"));
    assert.ok(agentsAfterUpdate.includes("footer"));
  });
});
