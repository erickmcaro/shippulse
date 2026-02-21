import path from "node:path";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const WORKFLOW_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "workflows",
  "idea-to-project"
);

describe("idea-to-project workflow", () => {
  it("has polling defaults aligned with bundled workflows", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    assert.ok(spec.polling, "polling config should exist");
    assert.equal(spec.polling.model, "default");
    assert.equal(spec.polling.timeoutSeconds, 240);
  });

  it("defines expected agents", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const ids = spec.agents.map((a) => a.id);
    assert.deepEqual(ids, ["planner", "builder", "verifier", "tester"]);
  });

  it("defines expected end-to-end steps", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const stepIds = spec.steps.map((s) => s.id);
    assert.deepEqual(stepIds, [
      "kb-scan",
      "ideate",
      "bootstrap",
      "implement",
      "verify",
      "test",
      "handoff",
    ]);
  });

  it("uses looped implementation with verify_each", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const implement = spec.steps.find((s) => s.id === "implement");
    assert.ok(implement, "implement step should exist");
    assert.equal(implement.type, "loop");
    assert.ok(implement.loop, "implement loop config should exist");
    assert.equal(implement.loop?.over, "stories");
    assert.equal(implement.loop?.completion, "all_done");
    assert.equal(implement.loop?.verifyEach, true);
    assert.equal(implement.loop?.verifyStep, "verify");
  });

  it("uses only local seed knowledgebase path", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const kbStep = spec.steps.find((s) => s.id === "kb-scan");
    assert.ok(kbStep, "kb-scan step should exist");
    assert.ok(kbStep.input.includes("./infra/seed"), "kb-scan should read local seed path");
    assert.ok(!kbStep.input.includes("/Users/Shared/Projects/Agile-Project-Management-Assistant"), "kb-scan should not depend on external project path");
  });
});
