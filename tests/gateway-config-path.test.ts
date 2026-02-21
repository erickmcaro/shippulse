import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

describe("gateway config path + JSON5 parsing", () => {
  let tmpDir = "";
  let originalConfigPath: string | undefined;

  before(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "shippulse-gateway-config-path-"));
    originalConfigPath = process.env.OPENCLAW_CONFIG_PATH;
  });

  after(async () => {
    if (originalConfigPath === undefined) delete process.env.OPENCLAW_CONFIG_PATH;
    else process.env.OPENCLAW_CONFIG_PATH = originalConfigPath;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("loads gateway auth/port from OPENCLAW_CONFIG_PATH with JSON5 syntax", async () => {
    const cfgPath = path.join(tmpDir, "openclaw.json5");
    await fs.writeFile(
      cfgPath,
      [
        "{",
        "  // JSON5 comment should be accepted",
        "  gateway: {",
        "    port: 19991,",
        "    auth: {",
        "      mode: 'password',",
        "      password: 'json5-password',",
        "    },",
        "  },",
        "}",
      ].join("\n"),
      "utf-8",
    );
    process.env.OPENCLAW_CONFIG_PATH = cfgPath;

    const mod = await import(`../dist/installer/gateway-api.js?v=json5-${Date.now()}`);
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = mock.fn(async (url: string, init: any) => {
      capturedUrl = url;
      capturedHeaders = init.headers || {};
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { id: "job-json5" } }),
      };
    }) as any;

    try {
      const result = await mod.createAgentCronJob({
        name: "test/json5-config",
        schedule: { kind: "every", everyMs: 300_000 },
        sessionTarget: "isolated",
        agentId: "test-agent",
        payload: { kind: "agentTurn", message: "test prompt" },
        enabled: true,
      });
      assert.equal(result.ok, true);
      assert.match(capturedUrl, /^http:\/\/127\.0\.0\.1:19991\/tools\/invoke$/);
      assert.equal(capturedHeaders.Authorization, "Bearer json5-password");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to default gateway port when config port is invalid", async () => {
    const cfgPath = path.join(tmpDir, "openclaw-invalid-port.json5");
    await fs.writeFile(
      cfgPath,
      [
        "{",
        "  gateway: {",
        "    port: 'not-a-port',",
        "    auth: {",
        "      mode: 'token',",
        "      token: 'fallback-token',",
        "    },",
        "  },",
        "}",
      ].join("\n"),
      "utf-8",
    );
    process.env.OPENCLAW_CONFIG_PATH = cfgPath;

    const mod = await import(`../dist/installer/gateway-api.js?v=invalid-port-${Date.now()}`);
    const originalFetch = globalThis.fetch;
    let capturedUrl = "";
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = mock.fn(async (url: string, init: any) => {
      capturedUrl = url;
      capturedHeaders = init.headers || {};
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { id: "job-invalid-port" } }),
      };
    }) as any;

    try {
      const result = await mod.createAgentCronJob({
        name: "test/invalid-port",
        schedule: { kind: "every", everyMs: 300_000 },
        sessionTarget: "isolated",
        agentId: "test-agent",
        payload: { kind: "agentTurn", message: "test prompt" },
        enabled: true,
      });
      assert.equal(result.ok, true);
      assert.match(capturedUrl, /^http:\/\/127\.0\.0\.1:18789\/tools\/invoke$/);
      assert.equal(capturedHeaders.Authorization, "Bearer fallback-token");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("normalizes auth mode casing/whitespace from config", async () => {
    const cfgPath = path.join(tmpDir, "openclaw-auth-normalization.json5");
    await fs.writeFile(
      cfgPath,
      [
        "{",
        "  gateway: {",
        "    port: 19992,",
        "    auth: {",
        "      mode: '  PASSWORD  ',",
        "      password: 'normalized-password',",
        "    },",
        "  },",
        "}",
      ].join("\n"),
      "utf-8",
    );
    process.env.OPENCLAW_CONFIG_PATH = cfgPath;

    const mod = await import(`../dist/installer/gateway-api.js?v=auth-normalize-${Date.now()}`);
    const originalFetch = globalThis.fetch;
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = mock.fn(async (_url: string, init: any) => {
      capturedHeaders = init.headers || {};
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true, result: { id: "job-auth-normalize" } }),
      };
    }) as any;

    try {
      const result = await mod.createAgentCronJob({
        name: "test/auth-normalize",
        schedule: { kind: "every", everyMs: 300_000 },
        sessionTarget: "isolated",
        agentId: "test-agent",
        payload: { kind: "agentTurn", message: "test prompt" },
        enabled: true,
      });
      assert.equal(result.ok, true);
      assert.equal(capturedHeaders.Authorization, "Bearer normalized-password");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
