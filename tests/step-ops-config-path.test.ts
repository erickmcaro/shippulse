import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type StepOpsModule = typeof import("../dist/installer/step-ops.js");

let dbMod: DbModule;
let stepOpsMod: StepOpsModule;
let tmpHome = "";
let originalHome: string | undefined;
let originalConfigPath: string | undefined;

describe("step-ops config path resolution", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-stepops-config-path-"));
    originalHome = process.env.HOME;
    originalConfigPath = process.env.OPENCLAW_CONFIG_PATH;
    process.env.HOME = tmpHome;
    dbMod = await import("../dist/db.js");
    stepOpsMod = await import("../dist/installer/step-ops.js");
  });

  beforeEach(() => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
  });

  after(async () => {
    if (originalConfigPath === undefined) delete process.env.OPENCLAW_CONFIG_PATH;
    else process.env.OPENCLAW_CONFIG_PATH = originalConfigPath;
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("reads agent workspace via OPENCLAW_CONFIG_PATH when resolving loop progress", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const storyId = crypto.randomUUID();
    const ts = new Date().toISOString();
    const agentId = "feature-dev_developer";

    const workspaceDir = path.join(tmpHome, "workspace-from-config-path");
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, `progress-${runId}.txt`), "Progress from config path\n", "utf-8");

    const cfgPath = path.join(tmpHome, "custom-openclaw.json5");
    await fs.writeFile(
      cfgPath,
      [
        "{",
        "  agents: {",
        "    list: [",
        `      { id: '${agentId}', workspace: '${workspaceDir.replace(/\\/g, "\\\\")}' },`,
        "    ],",
        "  },",
        "}",
      ].join("\n"),
      "utf-8",
    );
    process.env.OPENCLAW_CONFIG_PATH = cfgPath;

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'loop task', 'running', '{}', ?, ?)",
    ).run(runId, ts, ts);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, type, loop_config, created_at, updated_at) VALUES (?, ?, 'implement', ?, 0, 'STATUS: working\\n{{progress}}', 'STATUS', 'pending', 'loop', '{\"over\":\"stories\"}', ?, ?)",
    ).run(stepId, runId, agentId, ts, ts);
    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, created_at, updated_at) VALUES (?, ?, 0, 'S-1', 'Story 1', 'desc', '[\"ac\"]', 'pending', ?, ?)",
    ).run(storyId, runId, ts, ts);

    const claim = stepOpsMod.claimStep(agentId);
    assert.equal(claim.found, true);
    assert.ok(claim.resolvedInput?.includes("Progress from config path"));
  });
});
