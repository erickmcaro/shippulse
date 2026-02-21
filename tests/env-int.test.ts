import { describe, it } from "node:test";
import assert from "node:assert/strict";

type EnvIntModule = typeof import("../dist/lib/env-int.js");
let envIntMod: EnvIntModule;

describe("readPositiveIntEnv", () => {
  it("rejects partially numeric values and falls back", async () => {
    envIntMod ??= await import(`../dist/lib/env-int.js?v=env-int-${Date.now()}`);
    const name = "SHIPPULSE_TEST_ENV_INT";
    const original = process.env[name];
    process.env[name] = "12abc";
    try {
      assert.equal(envIntMod.readPositiveIntEnv(name, 42), 42);
    } finally {
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  });

  it("accepts valid positive integers with surrounding whitespace", async () => {
    envIntMod ??= await import(`../dist/lib/env-int.js?v=env-int-${Date.now()}`);
    const name = "SHIPPULSE_TEST_ENV_INT";
    const original = process.env[name];
    process.env[name] = "  15  ";
    try {
      assert.equal(envIntMod.readPositiveIntEnv(name, 1), 15);
    } finally {
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  });
});
