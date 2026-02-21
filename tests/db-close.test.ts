import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("db close/reopen", () => {
  let tmpRoot = "";
  let stateDir = "";
  let originalStateDir: string | undefined;

  before(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-db-close-"));
    stateDir = path.join(tmpRoot, "state");
    originalStateDir = process.env.OPENCLAW_STATE_DIR;
    process.env.OPENCLAW_STATE_DIR = stateDir;
  });

  after(async () => {
    if (originalStateDir === undefined) delete process.env.OPENCLAW_STATE_DIR;
    else process.env.OPENCLAW_STATE_DIR = originalStateDir;
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("reopens a fresh handle after closeDb", async () => {
    const dbMod = await import(`../dist/db.js?v=db-close-${Date.now()}`);
    const first = dbMod.getDb();
    const firstPath = dbMod.getDbPath();

    first.exec("SELECT 1");
    dbMod.closeDb();

    const second = dbMod.getDb();
    second.exec("SELECT 1");

    assert.notEqual(first, second);
    assert.equal(dbMod.getDbPath(), firstPath);
  });
});
