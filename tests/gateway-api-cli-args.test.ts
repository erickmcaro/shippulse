import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCreateCronCliArgs } from "../dist/installer/gateway-api.js";

describe("gateway-api CLI fallback args", () => {
  const baseJob = {
    name: "shippulse/test/agent",
    schedule: { kind: "every", everyMs: 300_000 },
    sessionTarget: "isolated",
    agentId: "test_agent",
    payload: {
      kind: "agentTurn",
      message: "ping",
      timeoutSeconds: 120,
    },
    enabled: true,
  } as const;

  it("omits delivery flags for mode=none", () => {
    const args = buildCreateCronCliArgs({
      ...baseJob,
      delivery: { mode: "none" },
    });

    assert.ok(!args.includes("--delivery"), "should not pass unsupported --delivery flag");
    assert.ok(!args.includes("--announce"), "should not announce when mode is none");
  });

  it("includes payload kind in CLI fallback args", () => {
    const args = buildCreateCronCliArgs({
      ...baseJob,
      payload: {
        ...baseJob.payload,
        kind: "agentTurn",
      },
    });

    const kindIdx = args.indexOf("--kind");
    assert.ok(kindIdx !== -1, "should include --kind");
    assert.equal(args[kindIdx + 1], "agentTurn", "should pass payload.kind value");
  });

  it("uses --announce for mode=announce", () => {
    const args = buildCreateCronCliArgs({
      ...baseJob,
      delivery: { mode: "announce" },
    });

    assert.ok(args.includes("--announce"), "should use OpenClaw-compatible announce flag");
  });
});
