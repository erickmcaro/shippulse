import path from "node:path";
import { loadWorkflowSpec } from "../dist/installer/workflow-spec.js";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const WORKFLOW_DIR = path.resolve(
  import.meta.dirname,
  "..",
  "workflows",
  "project-gap-analysis"
);

describe("project-gap-analysis workflow", () => {
  it("has polling defaults aligned with bundled workflows", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    assert.ok(spec.polling, "polling config should exist");
    assert.equal(spec.polling.model, "default");
    assert.equal(spec.polling.timeoutSeconds, 180);
  });

  it("defines expected agents", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const ids = spec.agents.map((a) => a.id);
    assert.deepEqual(ids, ["repo-analyst", "epic-gap-planner", "feature-gap-designer"]);
  });

  it("defines expected steps", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const stepIds = spec.steps.map((s) => s.id);
    assert.deepEqual(stepIds, ["repo-scan", "generate-missing-epics", "generate-missing-features"]);
  });

  it("passes missing epics output into missing feature generation input", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const featureStep = spec.steps.find((s) => s.id === "generate-missing-features");
    assert.ok(featureStep, "generate-missing-features step should exist");
    assert.ok(
      featureStep.input.includes("{{missing_epics_json}}"),
      "missing-features step should consume MISSING_EPICS_JSON context"
    );
  });

  it("requires repo analysis context for gap planning", async () => {
    const spec = await loadWorkflowSpec(WORKFLOW_DIR);
    const scanStep = spec.steps.find((s) => s.id === "repo-scan");
    const epicStep = spec.steps.find((s) => s.id === "generate-missing-epics");
    assert.ok(scanStep, "repo-scan step should exist");
    assert.ok(epicStep, "generate-missing-epics step should exist");
    assert.ok(epicStep.input.includes("{{project_summary}}"), "epic step should consume project summary");
    assert.ok(epicStep.input.includes("{{current_epics_json}}"), "epic step should consume current epics");
    assert.ok(epicStep.input.includes("{{known_gaps_json}}"), "epic step should consume known gaps");
  });
});
