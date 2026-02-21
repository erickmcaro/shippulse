import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

type DbModule = typeof import("../dist/db.js");
type ArtifactsModule = typeof import("../dist/installer/planning-artifacts.js");

let dbMod: DbModule;
let artifactsMod: ArtifactsModule;
let tmpHome = "";
let originalHome: string | undefined;

function now(): string {
  return new Date().toISOString();
}

describe("planning artifacts persistence", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-planning-artifacts-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    dbMod = await import("../dist/db.js");
    artifactsMod = await import("../dist/installer/planning-artifacts.js");
  });

  beforeEach(() => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
  });

  after(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("extracts and stores epics/features/stories from step output", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const ts = now();
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 1, 'idea-to-project', 'idea', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);

    const output = [
      "STATUS: done",
      "EPICS_JSON: [{\"id\":\"E-1\",\"title\":\"Platform\"}]",
      "FEATURES_JSON: [{\"id\":\"F-1\",\"title\":\"Auth\"}]",
      "STORIES_JSON: [{\"id\":\"S-1\",\"title\":\"Login\",\"description\":\"d\",\"acceptanceCriteria\":[\"a\"]}]",
    ].join("\n");

    artifactsMod.updatePlanningArtifactsFromOutput(runId, output);
    const artifacts = artifactsMod.getPlanningArtifacts(runId);
    assert.ok(artifacts);
    assert.equal(Array.isArray(artifacts?.epics), true);
    assert.equal((artifacts?.epics as Array<{ id: string }>)[0].id, "E-1");
    assert.equal((artifacts?.features as Array<{ id: string }>)[0].id, "F-1");
    assert.equal((artifacts?.stories as Array<{ id: string }>)[0].id, "S-1");
  });

  it("maps gap-analysis missing outputs into planning artifacts for dashboard handoff", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const ts = now();
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 3, 'project-gap-analysis', 'gap', 'running', '{}', ?, ?)"
    ).run(runId, ts, ts);

    const output = [
      "STATUS: done",
      "MISSING_EPICS_JSON: [{\"id\":\"ME-1\",\"title\":\"Billing\"}]",
      "MISSING_FEATURES_BY_EPIC_JSON: [{\"epicId\":\"ME-1\",\"epicTitle\":\"Billing\",\"features\":[{\"title\":\"Invoices\",\"description\":\"d\",\"acceptanceCriteria\":[{\"given\":\"g\",\"when\":\"w\",\"then\":\"t\"}],\"whyMissing\":\"missing\"}]}]",
      "PRIORITIZED_GAP_BACKLOG_JSON: [{\"epicId\":\"ME-1\",\"featureTitle\":\"Invoices\",\"priority\":\"P1\",\"rationale\":\"core\"}]",
    ].join("\n");

    artifactsMod.updatePlanningArtifactsFromOutput(runId, output);
    const artifacts = artifactsMod.getPlanningArtifacts(runId) as any;
    assert.ok(artifacts);
    assert.equal((artifacts.epics as Array<{ id: string }>)[0].id, "ME-1");
    assert.equal((artifacts.featuresByEpic as Array<{ epicId: string }>)[0].epicId, "ME-1");
    assert.equal((artifacts.missingEpics as Array<{ id: string }>)[0].id, "ME-1");
    assert.equal((artifacts.missingFeaturesByEpic as Array<{ epicId: string }>)[0].epicId, "ME-1");
    assert.equal((artifacts.prioritizedGapBacklog as Array<{ priority: string }>)[0].priority, "P1");
  });

  it("falls back to run context for older runs without planning_artifacts", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const ts = now();
    const context = {
      epics_json: JSON.stringify([{ id: "E-legacy" }]),
      features_json: JSON.stringify([{ id: "F-legacy" }]),
    };
    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, planning_artifacts, created_at, updated_at) VALUES (?, 2, 'product-planning', 'legacy', 'completed', ?, NULL, ?, ?)"
    ).run(runId, JSON.stringify(context), ts, ts);

    const artifacts = artifactsMod.getPlanningArtifacts(runId);
    assert.ok(artifacts);
    assert.equal((artifacts?.epics as Array<{ id: string }>)[0].id, "E-legacy");
    assert.equal((artifacts?.features as Array<{ id: string }>)[0].id, "F-legacy");
  });
});
