import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("workflow agent subagent policy", () => {
  it("allows each workflow agent to spawn itself", () => {
    const installPath = path.resolve(import.meta.dirname, "../dist/installer/install.js");
    const source = fs.readFileSync(installPath, "utf-8");

    assert.ok(
      source.includes("return { allowAgents: [agentId] };"),
      "install should build allowAgents with the same agentId"
    );
    assert.ok(
      source.includes("subagents: buildSubagentPolicy(agent.id)"),
      "install should attach per-agent subagent policy"
    );
  });
});

