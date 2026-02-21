import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendWorkflowForTask } from "../dist/installer/workflow-intent.js";

describe("workflow intent guardrails", () => {
  const all = [
    "feature-dev",
    "project-gap-analysis",
    "product-planning",
    "idea-to-project",
    "bug-fix",
  ];

  it("recommends project-gap-analysis for missing epics/features analysis tasks", () => {
    const rec = recommendWorkflowForTask(
      "Analyze repository /repo and output only missing epics and missing features",
      all,
    );
    assert.ok(rec);
    assert.equal(rec?.workflowId, "project-gap-analysis");
    assert.equal(rec?.confidence, "high");
  });

  it("recommends feature-dev for implementation tasks using gap-analysis artifacts", () => {
    const rec = recommendWorkflowForTask(
      "Implement highest-priority missing features from completed gap analysis.\nSOURCE_RUN_ID: 123\nMISSING_EPICS_JSON: []\nMISSING_FEATURES_BY_EPIC_JSON: []",
      all,
    );
    assert.ok(rec);
    assert.equal(rec?.workflowId, "feature-dev");
    assert.equal(rec?.confidence, "high");
  });

  it("recommends product-planning for planning-only tasks", () => {
    const rec = recommendWorkflowForTask(
      "Create epics, features, and a roadmap backlog for this concept",
      all,
    );
    assert.ok(rec);
    assert.equal(rec?.workflowId, "product-planning");
  });

  it("recommends idea-to-project for end-to-end build from idea prompts", () => {
    const rec = recommendWorkflowForTask(
      "Take this idea to project and bootstrap from scratch end-to-end",
      all,
    );
    assert.ok(rec);
    assert.equal(rec?.workflowId, "idea-to-project");
  });

  it("returns null when no deterministic match exists", () => {
    const rec = recommendWorkflowForTask("Fix flaky CI test in the existing service", all);
    assert.equal(rec, null);
  });

  it("returns null when recommended workflow is unavailable", () => {
    const rec = recommendWorkflowForTask(
      "Analyze repository and output only missing epics and features",
      ["feature-dev", "bug-fix"],
    );
    assert.equal(rec, null);
  });
});
