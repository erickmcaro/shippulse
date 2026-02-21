import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { SHIPPULSE_RUNTIME_ARTIFACTS } from "../dist/installer/uninstall.js";

describe("uninstall runtime artifact list", () => {
  it("includes daemon port and dashboard token metadata", () => {
    assert.equal(SHIPPULSE_RUNTIME_ARTIFACTS.includes("dashboard.port"), true);
    assert.equal(SHIPPULSE_RUNTIME_ARTIFACTS.includes("dashboard.token"), true);
  });

  it("includes legacy/cache artifacts that should be removed on full uninstall", () => {
    assert.equal(SHIPPULSE_RUNTIME_ARTIFACTS.includes("runs"), true);
    assert.equal(SHIPPULSE_RUNTIME_ARTIFACTS.includes("kb-index.json"), true);
  });

  it("has no duplicate entries", () => {
    const unique = new Set(SHIPPULSE_RUNTIME_ARTIFACTS);
    assert.equal(unique.size, SHIPPULSE_RUNTIME_ARTIFACTS.length);
  });
});
