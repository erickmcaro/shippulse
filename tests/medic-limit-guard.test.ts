import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type DbModule = typeof import("../dist/db.js");
type MedicModule = typeof import("../dist/medic/medic.js");

let dbMod: DbModule;
let medicMod: MedicModule;
let tmpRoot = "";
let stateDir = "";
let originalStateDir: string | undefined;

describe("medic history limit normalization", () => {
  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-medic-limit-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
    dbMod = await import(`../dist/db.js?v=medic-limit-${Date.now()}`);
    medicMod = await import(`../dist/medic/medic.js?v=medic-limit-${Date.now()}`);
  });

  beforeEach(() => {
    medicMod.ensureMedicTables();
    const db = dbMod.getDb();
    db.exec("DELETE FROM medic_checks;");
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    dbMod.closeDb();
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("falls back to default limit when a negative limit is provided", () => {
    const db = dbMod.getDb();
    const insert = db.prepare(
      "INSERT INTO medic_checks (id, checked_at, issues_found, actions_taken, summary, details) VALUES (?, ?, 0, 0, ?, '[]')",
    );
    for (let i = 0; i < 25; i++) {
      insert.run(`check-${i}`, new Date(Date.now() - i * 1000).toISOString(), `check ${i}`);
    }

    const checks = medicMod.getRecentMedicChecks(-1);
    assert.equal(checks.length, 20);
  });
});
