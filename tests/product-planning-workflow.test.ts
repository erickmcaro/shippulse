import path from "node:path";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const WORKFLOW_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "workflows",
  "product-planning"
);

describe("product-planning workflow", () => {
  it("has polling defaults aligned with bundled workflows", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    assert.ok(spec.polling, "polling config should exist");
    assert.equal(spec.polling.model, "default");
    assert.equal(spec.polling.timeoutSeconds, 120);
  });

  it("defines expected agents", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const ids = spec.agents.map((a) => a.id);
    assert.deepEqual(ids, ["epic-planner", "feature-designer"]);
  });

  it("defines expected steps", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const stepIds = spec.steps.map((s) => s.id);
    assert.deepEqual(stepIds, ["kb-scan", "generate-epics", "generate-features"]);
  });

  it("passes epics output into feature generation input", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const featureStep = spec.steps.find((s) => s.id === "generate-features");
    assert.ok(featureStep, "generate-features step should exist");
    assert.ok(featureStep.input.includes("{{epics_json}}"), "features step should consume EPICS_JSON context");
  });

  it("passes seed knowledgebase context into generation steps", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const kbStep = spec.steps.find((s) => s.id === "kb-scan");
    const epicStep = spec.steps.find((s) => s.id === "generate-epics");
    const featureStep = spec.steps.find((s) => s.id === "generate-features");
    assert.ok(kbStep, "kb-scan step should exist");
    assert.ok(epicStep, "generate-epics step should exist");
    assert.ok(featureStep, "generate-features step should exist");
    assert.ok(kbStep.input.includes("./infra/seed"), "kb-scan should read local seed path");
    assert.ok(!kbStep.input.includes("/Users/Shared/Projects/Agile-Project-Management-Assistant"), "kb-scan should not depend on external project path");
    assert.ok(epicStep.input.includes("{{kb_context}}"), "epic step should consume KB context");
    assert.ok(featureStep.input.includes("{{kb_context}}"), "feature step should consume KB context");
  });
});
