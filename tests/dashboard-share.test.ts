import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

type DbModule = typeof import("../dist/db.js");
type DashboardModule = typeof import("../dist/server/dashboard.js");
type EventsModule = typeof import("../dist/installer/events.js");

let dbMod: DbModule;
let dashboardMod: DashboardModule;
let eventsMod: EventsModule;
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

function now(): string {
  return new Date().toISOString();
}

describe("dashboard share recap", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-dashboard-share-"));
    originalHome = process.env.HOME;
    originalDashboardToken = process.env.SHIPPULSE_DASHBOARD_TOKEN;
    process.env.HOME = tmpHome;
    process.env.SHIPPULSE_DASHBOARD_TOKEN = DEFAULT_TEST_TOKEN;

    dbMod = await import("../dist/db.js");
    dashboardMod = await import("../dist/server/dashboard.js");
    eventsMod = await import("../dist/installer/events.js");
  });

  beforeEach(async () => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");

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

  it("returns a share payload and emits clicked/copied events", async () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const createdAt = now();
    const stepId = crypto.randomUUID();
    const storyId = crypto.randomUUID();

    db.prepare(
      "INSERT INTO runs (id, run_number, workflow_id, task, status, context, created_at, updated_at) VALUES (?, 7, 'feature-dev', 'Add share recap', 'running', '{}', ?, ?)"
    ).run(runId, createdAt, createdAt);

    db.prepare(
      "INSERT INTO steps (id, run_id, step_id, agent_id, step_index, input_template, expects, status, created_at, updated_at) VALUES (?, ?, 'plan', 'feature-dev_planner', 0, '', '', 'done', ?, ?)"
    ).run(stepId, runId, createdAt, createdAt);

    db.prepare(
      "INSERT INTO stories (id, run_id, story_index, story_id, title, description, acceptance_criteria, status, created_at, updated_at) VALUES (?, ?, 0, 'S-1', 'Story one', 'desc', '[]', 'done', ?, ?)"
    ).run(storyId, runId, createdAt, createdAt);

    server = dashboardMod.startDashboard(0);
    const addr = await getBoundAddress(server);
    const base = `http://127.0.0.1:${addr.port}`;

    const shareRes = await fetch(`${base}/api/runs/${runId}/share`);
    assert.equal(shareRes.status, 200);
    const sharePayload = await shareRes.json() as { shareText: string; shareUrl: string };
    assert.match(sharePayload.shareText, /ShipPulse run recap/);
    assert.match(sharePayload.shareText, /Workflow: feature-dev/);
    assert.match(sharePayload.shareText, /Stories: 1\/1 done/);
    assert.match(sharePayload.shareUrl, /\?run=/);

    const copiedRes = await fetch(`${base}/api/runs/${runId}/share-copied`, {
      method: "POST",
      headers: { Authorization: `Bearer ${DEFAULT_TEST_TOKEN}` },
    });
    assert.equal(copiedRes.status, 200);

    const eventsLimitedRes = await fetch(`${base}/api/runs/${runId}/events?limit=1`);
    assert.equal(eventsLimitedRes.status, 200);
    const limitedEvents = await eventsLimitedRes.json() as Array<{ event: string }>;
    assert.equal(limitedEvents.length, 1);

    const events = eventsMod.getRunEvents(runId);
    const eventTypes = events.map((evt) => evt.event);
    assert.ok(eventTypes.includes("run.share.clicked"));
    assert.ok(eventTypes.includes("run.share.copied"));
  });
});
