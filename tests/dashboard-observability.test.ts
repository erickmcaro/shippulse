import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

type DashboardModule = typeof import("../dist/server/dashboard.js");
type DbModule = typeof import("../dist/db.js");

let dashboardMod: DashboardModule;
let dbMod: DbModule;
let tmpHome = "";
let originalHome: string | undefined;
let originalDashboardToken: string | undefined;
let server: Server | null = null;

async function closeServer(): Promise<void> {
  if (!server) return;
  if (!server.listening) {
    server = null;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    server!.close((err) => err ? reject(err) : resolve());
  });
  server = null;
}

async function getBaseUrl(s: Server): Promise<string> {
  if (!s.listening) {
    await new Promise<void>((resolve, reject) => {
      s.once("listening", resolve);
      s.once("error", reject);
    });
  }
  const addr = s.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

describe("dashboard intent + stuck observability", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-dashboard-observability-"));
    originalHome = process.env.HOME;
    originalDashboardToken = process.env.SHIPPULSE_DASHBOARD_TOKEN;
    process.env.HOME = tmpHome;
    process.env.SHIPPULSE_DASHBOARD_TOKEN = "dashboard-test-token";
    dashboardMod = await import("../dist/server/dashboard.js");
    dbMod = await import("../dist/db.js");
  });

  beforeEach(async () => {
    await closeServer();
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
  });

  after(async () => {
    await closeServer();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalDashboardToken === undefined) delete process.env.SHIPPULSE_DASHBOARD_TOKEN;
    else process.env.SHIPPULSE_DASHBOARD_TOKEN = originalDashboardToken;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("recommends project-gap-analysis for gap-analysis requests", async () => {
    server = dashboardMod.startDashboardWithDeps(0);
    const base = await getBaseUrl(server);
    const res = await fetch(
      `${base}/api/workflows/recommend?task=${encodeURIComponent("Analyze repository and output only missing epics/features")}&selectedWorkflowId=idea-to-project`,
    );
    assert.equal(res.status, 200);
    const payload = await res.json() as {
      recommendation: { workflowId: string; confidence: string } | null;
      mismatch: boolean;
    };
    assert.ok(payload.recommendation);
    assert.equal(payload.recommendation?.workflowId, "project-gap-analysis");
    assert.equal(payload.mismatch, true);
  });

  it("returns stuckSignals and emits step.stuck events for long-running steps", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const stepId = crypto.randomUUID();
    const createdAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const updatedAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'feature-dev', 'Investigate', 'running', '{}', ?, ?)",
    ).run(runId, createdAt, createdAt);
    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, retry_count, max_retries, type, created_at, updated_at) VALUES (?, ?, 'implement', 'feature-dev_developer', 0, '', '', 'running', 0, 2, 'single', ?, ?)",
    ).run(stepId, runId, createdAt, updatedAt);

    server = dashboardMod.startDashboardWithDeps(0);
    const base = await getBaseUrl(server);

    const runRes = await fetch(`${base}/api/runs/${runId}`);
    assert.equal(runRes.status, 200);
    const runPayload = await runRes.json() as {
      stuckSignals?: Array<{ stepId: string; level: string; ageSeconds: number }>;
    };
    assert.ok(Array.isArray(runPayload.stuckSignals));
    assert.ok((runPayload.stuckSignals?.length ?? 0) >= 1, "should surface at least one stuck signal");
    assert.equal(runPayload.stuckSignals?.[0]?.stepId, "implement");

    const eventsRes = await fetch(`${base}/api/runs/${runId}/events`);
    assert.equal(eventsRes.status, 200);
    const events = await eventsRes.json() as Array<{ event: string }>;
    assert.ok(events.some((evt) => evt.event === "step.stuck"), "should emit dedicated step.stuck event");
  });

  it("returns a next-phase suggestion for completed project-gap-analysis runs", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const ts = new Date().toISOString();
    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'project-gap-analysis', 'Analyze repo', 'completed', ?, ?, ?)",
    ).run(runId, JSON.stringify({ repo: "/Users/Shared/projects2026/CaroBot" }), ts, ts);

    server = dashboardMod.startDashboardWithDeps(0, {
      getPlanningArtifactsFn: () => ({
        missingEpics: [{ id: "ME-1", title: "Billing" }],
        missingFeaturesByEpic: [{ epicId: "ME-1", epicTitle: "Billing", features: [{ title: "Invoices" }] }],
        prioritizedGapBacklog: [{ epicId: "ME-1", featureTitle: "Invoices", priority: "P1" }],
        updatedAt: ts,
      }),
    });
    const base = await getBaseUrl(server);

    const res = await fetch(`${base}/api/runs/${runId}/next-phase`);
    assert.equal(res.status, 200);
    const payload = await res.json() as {
      suggestion: {
        workflowId: string;
        taskDraft: string;
      } | null;
    };
    assert.ok(payload.suggestion);
    assert.equal(payload.suggestion?.workflowId, "feature-dev");
    assert.match(payload.suggestion?.taskDraft ?? "", /TARGET_REPO: \/Users\/Shared\/projects2026\/CaroBot/);
    assert.match(payload.suggestion?.taskDraft ?? "", /MISSING_EPICS_JSON:/);
    assert.match(payload.suggestion?.taskDraft ?? "", /PRIORITIZED_GAP_BACKLOG_JSON:/);
  });

  it("returns workflow-switch suggestion when task intent mismatches run workflow", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const ts = new Date().toISOString();
    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 'idea-to-project', 'Analyze repo /Users/Shared/projects2026/CaroBot and output only missing epics/features', 'cancelled', '{}', ?, ?)",
    ).run(runId, ts, ts);

    server = dashboardMod.startDashboardWithDeps(0);
    const base = await getBaseUrl(server);
    const res = await fetch(`${base}/api/runs/${runId}/next-phase`);
    assert.equal(res.status, 200);
    const payload = await res.json() as {
      suggestion: {
        workflowId: string;
        label: string;
        taskDraft: string;
      } | null;
    };
    assert.ok(payload.suggestion);
    assert.equal(payload.suggestion?.workflowId, "project-gap-analysis");
    assert.match(payload.suggestion?.label ?? "", /Switch to/i);
    assert.match(payload.suggestion?.taskDraft ?? "", /Analyze repo/);
  });
});
