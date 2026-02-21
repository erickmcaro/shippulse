import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { validateAndNormalizeStepOutput } from "../dist/installer/output-validation.js";

describe("output validation", () => {
  it("accepts valid epic output", () => {
    const parsed = {
      status: "done",
      epics_json: JSON.stringify([
        { id: "E-1", title: "Onboarding", description: "Improve first-run funnel" },
        { id: "E-2", title: "Billing", description: "Enable monetization" },
        { id: "E-3", title: "Analytics", description: "Track adoption" },
        { id: "E-4", title: "Reliability", description: "Hardening and observability" },
      ]),
      coverage_json: JSON.stringify({ addressed: ["core"], notAddressed: [], assumptions: [], consolidationNotes: [] }),
    };

    const result = validateAndNormalizeStepOutput("product-planning", "generate-epics", parsed);
    assert.equal(result.ok, true);
    assert.ok(result.normalized.epics_json);
    assert.ok(result.normalized.coverage_json);
  });

  it("rejects feature groups with fewer than 2 features", () => {
    const parsed = {
      status: "done",
      features_by_epic_json: JSON.stringify([
        {
          epicId: "E-1",
          epicTitle: "Onboarding",
          features: [
            {
              title: "Single feature only",
              description: "Too small for required constraints",
              acceptanceCriteria: [{ given: "g", when: "w", then: "t" }],
            },
          ],
        },
      ]),
    };

    const result = validateAndNormalizeStepOutput("product-planning", "generate-features", parsed);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" | "), /2-5 features/i);
  });

  it("rejects ideate output with non-absolute repo", () => {
    const parsed = {
      status: "done",
      repo: "relative/path",
      branch: "feature/initial-build",
      epics_json: JSON.stringify([
        { title: "E1", description: "d1" },
        { title: "E2", description: "d2" },
        { title: "E3", description: "d3" },
        { title: "E4", description: "d4" },
      ]),
      features_json: JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ title: `F${i + 1}`, description: `D${i + 1}` }))),
      stories_json: JSON.stringify([
        { id: "S-1", title: "Story 1", description: "Desc", acceptanceCriteria: ["A"] },
      ]),
    };

    const result = validateAndNormalizeStepOutput("idea-to-project", "ideate", parsed);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" | "), /REPO must be an absolute path/i);
  });

  it("accepts valid missing-epics output for project-gap-analysis", () => {
    const parsed = {
      status: "done",
      missing_epics_json: JSON.stringify([
        {
          id: "ME-1",
          title: "Role-based access control",
          description: "Introduce role-scoped permissions across admin surfaces.",
          acceptanceCriteria: [{ given: "an admin", when: "roles are assigned", then: "access is enforced" }],
          priority: "P1",
          estimatedSize: "M",
          successMetric: "0 unauthorized access paths in audit",
          whyMissing: "No centralized role policy found in current code paths",
        },
        {
          id: "ME-2",
          title: "Audit trail",
          description: "Track privileged actions with immutable logs.",
          acceptanceCriteria: [{ given: "a privileged action", when: "it executes", then: "an audit event is recorded" }],
          priority: "P1",
          estimatedSize: "M",
          successMetric: "100% privileged actions emit audit events",
          whyMissing: "No durable audit event sink discovered",
        },
        {
          id: "ME-3",
          title: "Operational observability",
          description: "Add system health and alerting visibility.",
          acceptanceCriteria: [{ given: "a failure mode", when: "it occurs", then: "operators are alerted" }],
          priority: "P2",
          estimatedSize: "M",
          successMetric: "P1 incidents detected within 5 minutes",
          whyMissing: "No alerting coverage for critical pipeline jobs",
        },
        {
          id: "ME-4",
          title: "Data lifecycle controls",
          description: "Retention and purge policy controls for sensitive data.",
          acceptanceCriteria: [{ given: "retention policy", when: "window expires", then: "data is purged" }],
          priority: "P2",
          estimatedSize: "S",
          successMetric: "Policy enforcement at 100% of configured datasets",
          whyMissing: "No automated lifecycle routines are currently configured",
        },
      ]),
      epic_gap_coverage_json: JSON.stringify({
        addressed: ["security posture", "operations", "compliance"],
        stillUncovered: [],
        assumptions: ["single-tenant internal deployment"],
        exclusions: ["mobile clients"],
      }),
    };

    const result = validateAndNormalizeStepOutput("project-gap-analysis", "generate-missing-epics", parsed);
    assert.equal(result.ok, true);
    assert.ok(result.normalized.missing_epics_json);
    assert.ok(result.normalized.epic_gap_coverage_json);
  });

  it("rejects missing-feature output when whyMissing is absent", () => {
    const parsed = {
      status: "done",
      missing_features_by_epic_json: JSON.stringify([
        {
          epicId: "ME-1",
          epicTitle: "Role-based access control",
          features: [
            {
              title: "Permission matrix engine",
              description: "Evaluate role-action-resource decisions",
              acceptanceCriteria: [{ given: "a role", when: "an action is requested", then: "engine returns allow/deny" }],
              priority: "P1",
              estimatedSize: "M",
            },
          ],
        },
      ]),
    };

    const result = validateAndNormalizeStepOutput("project-gap-analysis", "generate-missing-features", parsed);
    assert.equal(result.ok, false);
    assert.match(result.errors.join(" | "), /whyMissing is required/i);
  });
});
