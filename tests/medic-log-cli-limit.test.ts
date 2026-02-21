import { describe, it, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

type DbModule = typeof import("../dist/db.js");
type MedicModule = typeof import("../dist/medic/medic.js");

let dbMod: DbModule;
let medicMod: MedicModule;
let tmpHome = "";
let originalHome: string | undefined;
let originalStateDir: string | undefined;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli", "cli.js");

describe("cli medic log limit parsing", () => {
  before(async () => {
    tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-medic-log-cli-"));
    originalHome = process.env.HOME;
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.HOME = tmpHome;
    delete process.env.OPENCLAW_STATE_DIR;
    dbMod = await import(`../dist/db.js?v=medic-log-cli-${Date.now()}`);
    medicMod = await import(`../dist/medic/medic.js?v=medic-log-cli-${Date.now()}`);
  });

  beforeEach(() => {
    medicMod.ensureMedicTables();
    const db = dbMod.getDb();
    db.exec("DELETE FROM medic_checks;");
  });

  after(async () => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    dbMod.closeDb();
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  it("falls back to default limit when medic log argument is malformed", () => {
    const db = dbMod.getDb();
    const insert = db.prepare(
      "INSERT INTO medic_checks (id, checked_at, issues_found, actions_taken, summary, details) VALUES (?, ?, 0, 0, ?, '[]')",
    );
    for (let i = 0; i < 25; i++) {
      insert.run(`check-${i}`, new Date(Date.now() - i * 1000).toISOString(), `check ${i}`);
    }

    const output = execFileSync("node", [cliPath, "medic", "log", "2abc"], {
      cwd: repoRoot,
      encoding: "utf-8",
      env: { ...process.env, HOME: tmpHome },
    });

    const renderedRows = output
      .split("\n")
      .filter((line) => /^\s+[.~X]\s/.test(line))
      .length;
    assert.equal(renderedRows, 20);
  });
});
