import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

type DashboardModule = typeof import("../dist/server/dashboard.js");

let dashboardMod: DashboardModule;
let tmpHome = "";
let originalHome: string | undefined;
let originalDashboardToken: string | undefined;
let server: Server | null = null;
const DEFAULT_TEST_TOKEN = "test-token";

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

async function getBoundAddress(s: Server): Promise<AddressInfo> {
  if (!s.listening) {
    await new Promise<void>((resolve, reject) => {
      s.once("listening", () => resolve());
      s.once("error", (err) => reject(err));
    });
  }
  const addr = s.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Dashboard server did not bind to a TCP port");
  }
  return addr;
}

describe("dashboard run creation API", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-dashboard-run-"));
    originalHome = process.env.HOME;
    originalDashboardToken = process.env.SHIPPULSE_DASHBOARD_TOKEN;
    process.env.HOME = tmpHome;
    process.env.SHIPPULSE_DASHBOARD_TOKEN = DEFAULT_TEST_TOKEN;
    dashboardMod = await import("../dist/server/dashboard.js");
  });

  beforeEach(async () => {
    await closeServer();
  });

  after(async () => {
    await closeServer();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalDashboardToken === undefined) delete process.env.SHIPPULSE_DASHBOARD_TOKEN;
    else process.env.SHIPPULSE_DASHBOARD_TOKEN = originalDashboardToken;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("starts a run from POST /api/runs", async () => {
    let captured: { workflowId: string; taskTitle: string; notifyUrl?: string } | null = null;

    server = dashboardMod.startDashboardWithDeps(0, {
      runWorkflowFn: async (params) => {
        captured = params;
        return {
          id: "run-123",
          runNumber: 42,
          workflowId: params.workflowId,
          task: params.taskTitle,
          status: "running",
        };
      },
    });
    const addr = await getBoundAddress(server);
    const base = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${base}/api/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEFAULT_TEST_TOKEN}`,
      },
      body: JSON.stringify({
        workflowId: "idea-to-project",
        task: "Build an AI planning assistant for ops teams",
      }),
    });

    assert.equal(res.status, 201);
    const payload = await res.json() as { id: string; runNumber: number; workflowId: string; status: string };
    assert.equal(payload.id, "run-123");
    assert.equal(payload.runNumber, 42);
    assert.equal(payload.workflowId, "idea-to-project");
    assert.equal(payload.status, "running");

    assert.deepEqual(captured, {
      workflowId: "idea-to-project",
      taskTitle: "Build an AI planning assistant for ops teams",
      notifyUrl: undefined,
      contextOverrides: undefined,
    });
  });

  it("starts sequential orchestration for feature-dev gap-analysis requests", async () => {
    let captured: {
      workflowId: string;
      taskTitle: string;
      notifyUrl?: string;
      contextOverrides?: Record<string, string>;
    } | null = null;

    server = dashboardMod.startDashboardWithDeps(0, {
      runWorkflowFn: async (params) => {
        captured = params;
        return {
          id: "run-seq-1",
          runNumber: 77,
          workflowId: params.workflowId,
          task: params.taskTitle,
          status: "running",
        };
      },
    });
    const addr = await getBoundAddress(server);
    const base = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${base}/api/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEFAULT_TEST_TOKEN}`,
      },
      body: JSON.stringify({
        workflowId: "feature-dev",
        task: "Analyze repo /Users/Shared/projects2026/CaroBot and output only missing epics/features",
        sequentialOrchestration: true,
      }),
    });

    assert.equal(res.status, 201);
    const payload = await res.json() as {
      workflowId: string;
      orchestration?: { mode: string; entryWorkflowId: string; nextWorkflowId: string };
    };
    assert.equal(payload.workflowId, "project-gap-analysis");
    assert.equal(payload.orchestration?.mode, "sequential");
    assert.equal(payload.orchestration?.entryWorkflowId, "project-gap-analysis");
    assert.equal(payload.orchestration?.nextWorkflowId, "feature-dev");

    assert.ok(captured);
    assert.equal(captured?.workflowId, "project-gap-analysis");
    assert.equal(captured?.contextOverrides?.orchestration_mode, "sequential");
    assert.equal(captured?.contextOverrides?.orchestration_state, "pending");
    assert.equal(captured?.contextOverrides?.orchestration_next_workflow, "feature-dev");
  });

  it("returns 400 when required fields are missing", async () => {
    server = dashboardMod.startDashboardWithDeps(0, {
      runWorkflowFn: async () => {
        throw new Error("should not be called");
      },
    });
    const addr = await getBoundAddress(server);
    const base = `http://127.0.0.1:${addr.port}`;

    const res = await fetch(`${base}/api/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEFAULT_TEST_TOKEN}`,
      },
      body: JSON.stringify({ workflowId: "idea-to-project" }),
    });

    assert.equal(res.status, 400);
    const payload = await res.json() as { error: string };
    assert.match(payload.error, /task is required/i);
  });

  it("exposes run controls and artifacts endpoints", async () => {
    server = dashboardMod.startDashboardWithDeps(0, {
      runWorkflowFn: async () => ({
        id: "ignored",
        runNumber: 1,
        workflowId: "idea-to-project",
        task: "ignored",
        status: "running",
      }),
      stopWorkflowFn: async () => ({ status: "ok", runId: "run-1", workflowId: "idea-to-project", cancelledSteps: 2 }),
      resumeWorkflowFn: async () => ({ status: "ok", runId: "run-1", workflowId: "idea-to-project", message: "resumed" }),
      retryFailedStoryFn: async () => ({ status: "ok", runId: "run-1", workflowId: "idea-to-project", storyId: "S-2", message: "retry queued" }),
      getPlanningArtifactsFn: () => ({
        epics: [{ id: "E-1", title: "Core Platform" }],
        features: [{ id: "F-1", title: "Auth" }],
        stories: [{ id: "S-1", title: "Login story" }],
        updatedAt: new Date().toISOString(),
      }),
    });
    const addr = await getBoundAddress(server);
    const base = `http://127.0.0.1:${addr.port}`;

    const stopRes = await fetch(`${base}/api/runs/run-1/stop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DEFAULT_TEST_TOKEN}` },
    });
    assert.equal(stopRes.status, 200);
    const stopPayload = await stopRes.json() as { status: string; cancelledSteps: number };
    assert.equal(stopPayload.status, "ok");
    assert.equal(stopPayload.cancelledSteps, 2);

    const resumeRes = await fetch(`${base}/api/runs/run-1/resume`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DEFAULT_TEST_TOKEN}` },
    });
    assert.equal(resumeRes.status, 200);
    const resumePayload = await resumeRes.json() as { status: string; message: string };
    assert.equal(resumePayload.status, "ok");
    assert.match(resumePayload.message, /resumed/i);

    const retryRes = await fetch(`${base}/api/runs/run-1/retry-story`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DEFAULT_TEST_TOKEN}` },
    });
    assert.equal(retryRes.status, 200);
    const retryPayload = await retryRes.json() as { status: string; storyId: string };
    assert.equal(retryPayload.status, "ok");
    assert.equal(retryPayload.storyId, "S-2");

    const artifactsRes = await fetch(`${base}/api/runs/run-1/artifacts`);
    assert.equal(artifactsRes.status, 200);
    const artifactsPayload = await artifactsRes.json() as { epics?: Array<{ id: string }>; features?: Array<{ id: string }>; stories?: Array<{ id: string }> };
    assert.equal(artifactsPayload.epics?.[0]?.id, "E-1");
    assert.equal(artifactsPayload.features?.[0]?.id, "F-1");
    assert.equal(artifactsPayload.stories?.[0]?.id, "S-1");
  });

  it("requires token for mutation endpoints when SHIPPULSE_DASHBOARD_TOKEN is set", async () => {
    const previousToken = process.env.SHIPPULSE_DASHBOARD_TOKEN;
    process.env.SHIPPULSE_DASHBOARD_TOKEN = "secret-token";
    let callCount = 0;
    try {
      server = dashboardMod.startDashboardWithDeps(0, {
        runWorkflowFn: async (params) => {
          callCount++;
          return {
            id: "run-secure",
            runNumber: 9,
            workflowId: params.workflowId,
            task: params.taskTitle,
            status: "running",
          };
        },
      });
      const addr = await getBoundAddress(server);
      const base = `http://127.0.0.1:${addr.port}`;

      const cfgRes = await fetch(`${base}/api/dashboard/config`);
      assert.equal(cfgRes.status, 200);
      const cfg = await cfgRes.json() as { mutationAuthRequired: boolean };
      assert.equal(cfg.mutationAuthRequired, true);

      const body = JSON.stringify({ workflowId: "idea-to-project", task: "Secure task" });
      const missingAuthRes = await fetch(`${base}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      assert.equal(missingAuthRes.status, 401);

      const invalidAuthRes = await fetch(`${base}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer wrong-token" },
        body,
      });
      assert.equal(invalidAuthRes.status, 401);

      const okRes = await fetch(`${base}/api/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer secret-token" },
        body,
      });
      assert.equal(okRes.status, 201);
      assert.equal(callCount, 1);
    } finally {
      if (previousToken === undefined) delete process.env.SHIPPULSE_DASHBOARD_TOKEN;
      else process.env.SHIPPULSE_DASHBOARD_TOKEN = previousToken;
    }
  });
});
