import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

type DbModule = typeof import("../dist/db.js");
type EventsModule = typeof import("../dist/installer/events.js");

let dbMod: DbModule;
let eventsMod: EventsModule;
let tmpHome = "";
let originalHome: string | undefined;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli", "cli.js");

function nowIso(): string {
  return new Date().toISOString();
}

describe("cli logs run-number lookup", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-logs-cli-"));
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;
    dbMod = await import("../dist/db.js");
    eventsMod = await import("../dist/installer/events.js");
  });

  beforeEach(async () => {
    const db = dbMod.getDb();
    db.exec("DELETE FROM stories;");
    db.exec("DELETE FROM steps;");
    db.exec("DELETE FROM runs;");
    await fs.rm(path.join(tmpHome, ".openclaw", "shippulse", "events.jsonl"), { force: true });
  });

  after(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("routes #<run-number> to run-number lookup instead of run-id prefix lookup", () => {
    const db = dbMod.getDb();
    const runId = crypto.randomUUID();
    const ts = nowIso();

    db.prepare(
      "INSERT INTO runs (id, workflow_id, task, status, context, run_number, created_at, updated_at) VALUES (?, 'test-workflow', 'task', 'running', '{}', 3, ?, ?)",
    ).run(runId, ts, ts);

    eventsMod.emitEvent({
      ts,
      event: "run.started",
      runId,
      workflowId: "test-workflow",
      detail: "started",
    });

    const output = execFileSync("node", [cliPath, "logs", "#3"], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: { ...process.env, HOME: tmpHome },
    });

    assert.match(output, /Run started/);
    assert.match(output, new RegExp(runId.slice(0, 8)));
    assert.doesNotMatch(output, /No events found for run matching/);
  });

  it("rejects oversized run numbers that are not safe integers", () => {
    const output = execFileSync("node", [cliPath, "logs", "#9007199254740993"], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: { ...process.env, HOME: tmpHome },
    });

    assert.match(output, /Invalid run number: #9007199254740993\./);
  });
});
