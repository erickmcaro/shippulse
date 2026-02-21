import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildFeatureDevTaskFromGapAnalysis,
  buildSequentialParentContext,
} from "../dist/installer/sequential-orchestration.js";

describe("sequential orchestration helpers", () => {
  it("builds parent context with pending sequential state", () => {
    const context = buildSequentialParentContext("feature-dev");
    assert.deepEqual(context, {
      orchestration_mode: "sequential",
      orchestration_state: "pending",
      orchestration_next_workflow: "feature-dev",
    });
  });

  it("builds feature-dev task draft from gap artifacts", () => {
    const task = buildFeatureDevTaskFromGapAnalysis({
      sourceRunId: "run-gap-1",
      repo: "/Users/Shared/projects2026/CaroBot",
      artifacts: {
        missingEpics: [{ id: "ME-1", title: "Billing" }],
        missingFeaturesByEpic: [{ epicId: "ME-1", features: [{ title: "Invoices" }] }],
        prioritizedGapBacklog: [{ epicId: "ME-1", featureTitle: "Invoices", priority: "P1" }],
      },
    });

    assert.match(task, /SOURCE_RUN_ID: run-gap-1/);
    assert.match(task, /TARGET_REPO: \/Users\/Shared\/projects2026\/CaroBot/);
    assert.match(task, /MISSING_EPICS_JSON:/);
    assert.match(task, /MISSING_FEATURES_BY_EPIC_JSON:/);
    assert.match(task, /PRIORITIZED_GAP_BACKLOG_JSON:/);
  });
});
