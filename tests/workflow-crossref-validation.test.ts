import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";

describe("workflow cross-reference validation", () => {
  let tmpDir: string;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-workflow-xref-"));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("rejects steps that reference unknown agents", async () => {
    const dir = path.join(tmpDir, "unknown-agent");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "workflow.yml"),
      `
id: xref-unknown-agent
name: Unknown Agent
version: 1

agents:
  - id: planner
    workspace:
      baseDir: agents/planner
      files:
        AGENTS.md: agents/planner/AGENTS.md

steps:
  - id: plan
    agent: missing-agent
    input: "Plan"
    expects: "STATUS: done"
`,
    );

    await assert.rejects(
      () => loadWorkflowSpec(dir),
      /references unknown agent/i,
    );
  });

  it("rejects retry_step references to unknown steps", async () => {
    const dir = path.join(tmpDir, "unknown-retry-step");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "workflow.yml"),
      `
id: xref-unknown-retry
name: Unknown Retry Step
version: 1

agents:
  - id: planner
    workspace:
      baseDir: agents/planner
      files:
        AGENTS.md: agents/planner/AGENTS.md

steps:
  - id: plan
    agent: planner
    input: "Plan"
    expects: "STATUS: done"
    on_fail:
      retry_step: does-not-exist
`,
    );

    await assert.rejects(
      () => loadWorkflowSpec(dir),
      /retry_step references unknown step/i,
    );
  });

  it("requires verify_step when verify_each is enabled", async () => {
    const dir = path.join(tmpDir, "missing-verify-step");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "workflow.yml"),
      `
id: xref-loop-verify
name: Loop Verify Guard
version: 1

agents:
  - id: developer
    workspace:
      baseDir: agents/developer
      files:
        AGENTS.md: agents/developer/AGENTS.md

steps:
  - id: implement
    agent: developer
    type: loop
    loop:
      over: stories
      completion: all_done
      verify_each: true
    input: "Implement"
    expects: "STATUS: done"
`,
    );

    await assert.rejects(
      () => loadWorkflowSpec(dir),
      /loop\.verify_step is required/i,
    );
  });

  it("parses valid retry_step and output_schema definitions", async () => {
    const dir = path.join(tmpDir, "valid-output-schema");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, "workflow.yml"),
      `
id: xref-valid
name: Valid
version: 1

agents:
  - id: planner
    workspace:
      baseDir: agents/planner
      files:
        AGENTS.md: agents/planner/AGENTS.md

steps:
  - id: plan
    agent: planner
    input: "Plan"
    expects: "STATUS: done"

  - id: verify
    agent: planner
    input: "Verify"
    expects: "STATUS: done"
    on_fail:
      retry_step: plan
    output_schema:
      required: [STATUS, TESTS]
      additional_properties: false
      properties:
        STATUS:
          type: string
          enum: [done, retry]
        TESTS:
          type: string
          min_length: 1
`,
    );

    const spec = await loadWorkflowSpec(dir);
    const verifyStep = spec.steps.find((s) => s.id === "verify");
    assert.ok(verifyStep, "verify step should exist");
    assert.equal(verifyStep?.on_fail?.retry_step, "plan");
    assert.deepEqual(verifyStep?.outputSchema?.required, ["status", "tests"]);
    assert.equal(verifyStep?.outputSchema?.additionalProperties, false);
    assert.deepEqual(verifyStep?.outputSchema?.properties.status?.enum, ["done", "retry"]);
  });
});
