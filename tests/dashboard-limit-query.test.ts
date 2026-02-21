import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

type DashboardModule = typeof import("../dist/server/dashboard.js");
type EventsModule = typeof import("../dist/installer/events.js");
type DbModule = typeof import("../dist/db.js");
type MedicModule = typeof import("../dist/medic/medic.js");

let dashboardMod: DashboardModule;
let eventsMod: EventsModule;
let dbMod: DbModule;
let medicMod: MedicModule;
let tmpRoot = "";
let stateDir = "";
let originalStateDir: string | undefined;
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

describe("dashboard query limit parsing", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-dashboard-limit-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    dbMod = await import(`../dist/db.js?v=dashboard-limit-${Date.now()}`);
    medicMod = await import(`../dist/medic/medic.js?v=dashboard-limit-${Date.now()}`);
    eventsMod = await import(`../dist/installer/events.js?v=dashboard-limit-${Date.now()}`);
    dashboardMod = await import(`../dist/server/dashboard.js?v=dashboard-limit-${Date.now()}`);
  });

  beforeEach(async () => {
    await closeServer();
    const db = dbMod.getDb();
    medicMod.ensureMedicTables();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
    db.exec("DELETE FROM medic_checks;");
    await fs.rm(path.join(stateDir, "shippulse", "events.jsonl"), { force: true });
  });

  after(async () => {
    await closeServer();
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    dbMod.closeDb();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("treats malformed events limit query as fallback default", async () => {
    const runId = crypto.randomUUID();
    const ts = new Date().toISOString();

    eventsMod.emitEvent({ ts, event: "run.started", runId, workflowId: "wf", detail: "a" });
    eventsMod.emitEvent({ ts, event: "step.running", runId, workflowId: "wf", detail: "b" });
    eventsMod.emitEvent({ ts, event: "step.done", runId, workflowId: "wf", detail: "c" });

    server = dashboardMod.startDashboard(0);
    const addr = await getBoundAddress(server);
    const res = await fetch(`http://127.0.0.1:${addr.port}/api/runs/${runId}/events?limit=2abc`);

    assert.equal(res.status, 200);
    const events = await res.json() as Array<{ detail?: string }>;
    assert.equal(events.length, 3);
    assert.equal(events[0].detail, "a");
  });

  it("treats malformed medic checks limit query as fallback default", async () => {
    const db = dbMod.getDb();
    const insert = db.prepare(
      "INSERT INTO medic_checks (id, checked_at, issues_found, actions_taken, summary, details) VALUES (?, ?, 0, 0, ?, '[]')",
    );
    for (let i = 0; i < 5; i++) {
      insert.run(`check-${i}`, new Date(Date.now() - i * 1000).toISOString(), `check ${i}`);
    }

    server = dashboardMod.startDashboard(0);
    const addr = await getBoundAddress(server);
    const res = await fetch(`http://127.0.0.1:${addr.port}/api/medic/checks?limit=2abc`);

    assert.equal(res.status, 200);
    const checks = await res.json() as Array<{ id: string }>;
    assert.equal(checks.length, 5);
  });
});
