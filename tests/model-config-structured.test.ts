import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import { buildPollingPrompt } from "../dist/installer/agent-cron.js";

async function makeWorkflow(yaml: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-model-"));
  await fs.writeFile(path.join(dir, "workflow.yml"), yaml, "utf-8");

  await fs.mkdir(path.join(dir, "agents", "reviewer"), { recursive: true });
  await fs.writeFile(path.join(dir, "agents", "reviewer", "AGENTS.md"), "# reviewer", "utf-8");

  return dir;
}

describe("structured model config", () => {
  it("parses model.primary + model.fallbacks from workflow.yml", async () => {
    const dir = await makeWorkflow(`
id: wf-model
name: WF model
version: 1
agents:
  - id: reviewer
    model:
      primary: openai/gpt-5
      fallbacks:
        - openai/gpt-4.1-mini
    workspace:
      baseDir: agents/reviewer
      files:
        AGENTS.md: agents/reviewer/AGENTS.md
steps:
  - id: review
    agent: reviewer
    input: hello
    expects: "STATUS: done"
`);
    try {
      const spec = await loadWorkflowSpec(dir);
      const model = spec.agents[0].model as { primary: string; fallbacks?: string[] };
      assert.equal(model.primary, "openai/gpt-5");
      assert.deepEqual(model.fallbacks, ["openai/gpt-4.1-mini"]);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects invalid structured model config", async () => {
    const dir = await makeWorkflow(`
id: wf-model-bad
name: WF model bad
version: 1
agents:
  - id: reviewer
    model:
      primary: ""
    workspace:
      baseDir: agents/reviewer
      files:
        AGENTS.md: agents/reviewer/AGENTS.md
steps:
  - id: review
    agent: reviewer
    input: hello
    expects: "STATUS: done"
`);
    try {
      await assert.rejects(
        () => loadWorkflowSpec(dir),
        /model\.primary must be a non-empty string/
      );
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("uses model.primary as the work model in polling prompt", () => {
    const prompt = buildPollingPrompt("wf", "reviewer", {
      primary: "openai/gpt-5",
      fallbacks: ["openai/gpt-4.1-mini"],
    } as any);
    assert.ok(prompt.includes('"openai/gpt-5"'));
    assert.ok(!prompt.includes("fallbacks"), "prompt should pass concrete model id, not object payload");
  });
});
