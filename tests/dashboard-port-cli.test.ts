import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cliPath = path.join(repoRoot, "dist", "cli", "cli.js");

async function occupyDefaultDashboardPort(): Promise<Server | null> {
  const server = createServer((_req, res) => {
    res.statusCode = 200;
    res.end("busy");
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const onError = (err: Error) => reject(err);
      server.once("error", onError);
      server.listen(3333, "127.0.0.1", () => {
        server.off("error", onError);
        resolve();
      });
    });
    return server;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") return null;
    throw err;
  }
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("cli dashboard --port parsing", () => {
  it("honors --port 0 even when default port is occupied", async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-dashboard-port-"));
    const blocker = await occupyDefaultDashboardPort();
    const env = { ...process.env, OPENCLAW_STATE_DIR: stateDir };

    try {
      const output = execFileSync("node", [cliPath, "dashboard", "--port", "0"], {
        cwd: repoRoot,
        encoding: "utf-8",
        env,
      });

      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      assert.ok(match, "expected dashboard URL in CLI output");
      const boundPort = Number.parseInt(match[1], 10);
      assert.ok(Number.isInteger(boundPort) && boundPort > 0, "expected a positive bound port");
      assert.notEqual(boundPort, 3333, "expected dynamic port, not fallback default 3333");
    } finally {
      try {
        execFileSync("node", [cliPath, "dashboard", "stop"], {
          cwd: repoRoot,
          env,
          stdio: "ignore",
        });
      } catch {
        // best-effort cleanup
      }
      if (blocker) {
        await closeServer(blocker);
      }
      await fs.rm(stateDir, { recursive: true, force: true });
    }
  });
});
