import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("openclaw-config writer", () => {
  let tmpRoot = "";

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-config-write-"));
  });

  after(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("creates parent directories for custom config paths", async () => {
    const mod = await import(`../dist/installer/openclaw-config.js?v=write-path-${Date.now()}`);
    const targetPath = path.join(tmpRoot, "nested", "custom", "openclaw.json");
    const config = {
      agents: {
        list: [{ id: "main", default: true }],
      },
    };

    await mod.writeOpenClawConfig(targetPath, config);
    const raw = await fs.readFile(targetPath, "utf-8");
    const parsed = JSON.parse(raw) as { agents?: { list?: Array<{ id?: string; default?: boolean }> } };
    assert.equal(parsed.agents?.list?.[0]?.id, "main");
    assert.equal(parsed.agents?.list?.[0]?.default, true);
  });
});
