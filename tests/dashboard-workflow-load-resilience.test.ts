import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type DashboardModule = typeof import("../dist/server/dashboard.js");

let dashboardMod: DashboardModule;
let tmpDir = "";

describe("dashboard workflow loader resilience", () => {
  before(async () => {
    dashboardMod = await import("../dist/server/dashboard.js");
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-dashboard-workflows-"));
  });

  after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("keeps valid workflows when one workflow.yml is malformed", async () => {
    const validDir = path.join(tmpDir, "valid-wf");
    const invalidDir = path.join(tmpDir, "invalid-wf");
    await fs.mkdir(validDir, { recursive: true });
    await fs.mkdir(invalidDir, { recursive: true });

    await fs.writeFile(
      path.join(validDir, "workflow.yml"),
      [
        "id: valid-wf",
        "name: Valid Workflow",
        "steps:",
        "  - id: plan",
        "    agent: planner",
      ].join("\n"),
      "utf-8",
    );
    await fs.writeFile(
      path.join(invalidDir, "workflow.yml"),
      "id: invalid-wf\nsteps: [\n",
      "utf-8",
    );

    const workflows = dashboardMod.loadWorkflowsFromDir(tmpDir);
    assert.ok(workflows.some((wf) => wf.id === "valid-wf"), "valid workflow should still load");
    assert.ok(!workflows.some((wf) => wf.id === "invalid-wf"), "malformed workflow should be skipped");
  });

  it("falls back to directory name when id/name are not strings", async () => {
    const oddDir = path.join(tmpDir, "odd-types");
    await fs.mkdir(oddDir, { recursive: true });
    await fs.writeFile(
      path.join(oddDir, "workflow.yml"),
      [
        "id: 123",
        "name: null",
        "steps:",
        "  - id: step-1",
        "    agent: planner",
      ].join("\n"),
      "utf-8",
    );

    const workflows = dashboardMod.loadWorkflowsFromDir(tmpDir);
    const odd = workflows.find((wf) => wf.id === "odd-types");
    assert.ok(odd, "workflow should load with directory fallback id");
    assert.equal(odd.name, "odd-types", "workflow name should fall back to directory name");
  });
});
