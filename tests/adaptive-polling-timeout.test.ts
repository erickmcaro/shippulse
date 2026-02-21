import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolvePollingTimeoutSeconds } from "../dist/installer/agent-cron.js";

describe("adaptive polling timeout resolver", () => {
  it("uses heavy workflow baseline when no overrides exist", () => {
    const workflow = {
      id: "idea-to-project",
      agents: [{ id: "planner", workspace: { baseDir: "agents/planner", files: {} } }],
      steps: [{ id: "plan", agent: "planner", input: "x", expects: "y" }],
    };
    assert.equal(resolvePollingTimeoutSeconds(workflow as any, "planner"), 240);
  });

  it("uses standard baseline for lightweight workflows", () => {
    const workflow = {
      id: "feature-dev",
      agents: [{ id: "developer", workspace: { baseDir: "agents/dev", files: {} } }],
      steps: [{ id: "implement", agent: "developer", input: "x", expects: "y" }],
    };
    assert.equal(resolvePollingTimeoutSeconds(workflow as any, "developer"), 120);
  });

  it("honors workflow-level timeout override", () => {
    const workflow = {
      id: "feature-dev",
      polling: { timeoutSeconds: 150 },
      agents: [{ id: "developer", workspace: { baseDir: "agents/dev", files: {} } }],
      steps: [{ id: "implement", agent: "developer", input: "x", expects: "y" }],
    };
    assert.equal(resolvePollingTimeoutSeconds(workflow as any, "developer"), 150);
  });

  it("agent override wins over workflow override", () => {
    const workflow = {
      id: "feature-dev",
      polling: { timeoutSeconds: 120 },
      agents: [
        {
          id: "developer",
          pollingTimeoutSeconds: 210,
          workspace: { baseDir: "agents/dev", files: {} },
        },
      ],
      steps: [{ id: "implement", agent: "developer", input: "x", expects: "y" }],
    };
    assert.equal(resolvePollingTimeoutSeconds(workflow as any, "developer"), 210);
  });

  it("step override wins over agent/workflow override", () => {
    const workflow = {
      id: "feature-dev",
      polling: { timeoutSeconds: 120 },
      agents: [
        {
          id: "developer",
          pollingTimeoutSeconds: 180,
          workspace: { baseDir: "agents/dev", files: {} },
        },
      ],
      steps: [
        {
          id: "implement",
          agent: "developer",
          pollingTimeoutSeconds: 300,
          input: "x",
          expects: "y",
        },
      ],
    };
    assert.equal(resolvePollingTimeoutSeconds(workflow as any, "developer"), 300);
  });

  it("clamps timeouts to safety bounds", () => {
    const high = {
      id: "feature-dev",
      agents: [{ id: "developer", pollingTimeoutSeconds: 9999, workspace: { baseDir: "agents/dev", files: {} } }],
      steps: [{ id: "implement", agent: "developer", input: "x", expects: "y" }],
    };
    const low = {
      id: "feature-dev",
      polling: { timeoutSeconds: 5 },
      agents: [{ id: "developer", workspace: { baseDir: "agents/dev", files: {} } }],
      steps: [{ id: "implement", agent: "developer", input: "x", expects: "y" }],
    };
    assert.equal(resolvePollingTimeoutSeconds(high as any, "developer"), 900);
    assert.equal(resolvePollingTimeoutSeconds(low as any, "developer"), 60);
  });
});

